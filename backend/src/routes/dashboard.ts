import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export function createDashboardRouter() {
  const router = Router();

  // GET /api/dashboard/stats — aggregated metrics for admin dashboard
  router.get('/stats', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (_req, res) => {
    try {
      // Queries paralelas para counts agregados
      const [
        { count: totalProducts },
        { data: dashVariants },           // ahora traemos sale_price_cents para calcular valor
        { count: soldCount },
        { count: warrantyCount },
        { data: recentMovements },
      ] = await Promise.all([
        _req.supabase!.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        _req.supabase!.from('product_variants')
          .select(`
            id, product_id, storage_gb, color, sale_price_cents, low_stock_threshold,
            product:product_id(id, model_name, brand:brand_id(name))
          `)
          .eq('is_active', true),
        _req.supabase!.from('inventory_items').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
        _req.supabase!.from('inventory_items').select('*', { count: 'exact', head: true }).eq('status', 'warranty'),
        _req.supabase!.from('stock_movements')
          .select(`
            id, movement_type, quantity, reference_note, created_at,
            variant:variant_id(
              storage_gb, color,
              product:product_id(model_name, brand:brand_id(name))
            )
          `)
          .order('created_at', { ascending: false })
          .limit(8),
      ]);

      const cleanedMovements = (recentMovements ?? []).map((m: any) => ({
        ...m,
        variant: m.variant ?? null,
      }));

      // Stock counts + valor total + stock bajo — todo en un solo pase
      let totalInStock = 0;
      let totalStockValue = 0;
      const lowStockItems: any[] = [];

      if (dashVariants && dashVariants.length > 0) {
        const variantIds = dashVariants.map((v: any) => v.id);

        const { data: stockCounts, error: countError } = await _req.supabase!
          .from('inventory_items')
          .select('variant_id')
          .in('variant_id', variantIds)
          .eq('status', 'in_stock');

        if (countError) {
          console.error('Error fetching stock counts:', countError);
          throw countError;
        }

        const countMap = new Map<string, number>();
        if (stockCounts) {
          for (const item of stockCounts) {
            countMap.set(item.variant_id, (countMap.get(item.variant_id) || 0) + 1);
          }
        }

        for (const v of dashVariants) {
          const stockCount = countMap.get(v.id) || 0;
          totalInStock += stockCount;
          totalStockValue += stockCount * (v.sale_price_cents || 0);

          if (stockCount <= v.low_stock_threshold) {
            lowStockItems.push({
              id: v.id,
              product_id: v.product_id,
              storage_gb: v.storage_gb,
              color: v.color,
              low_stock_threshold: v.low_stock_threshold,
              stock_count: stockCount,
              product: v.product,
            });
          }
        }
      }

      res.json({
        stats: {
          total_products: totalProducts ?? 0,
          total_variants: dashVariants?.length ?? 0,
          in_stock: totalInStock,
          total_stock_value: totalStockValue,
          sold: soldCount ?? 0,
          warranty: warrantyCount ?? 0,
          low_stock_count: lowStockItems.length,
        },
        low_stock: lowStockItems.sort((a: any, b: any) => a.stock_count - b.stock_count),
        recent_movements: cleanedMovements,
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      res.status(500).json({ error: 'Error al cargar estadísticas' });
    }
  });

  return router;
}
