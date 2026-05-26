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
        { count: totalVariants },
        { count: inStock },
        { count: soldCount },
        { count: warrantyCount },
        { data: recentMovements },
        { data: variants },
      ] = await Promise.all([
        _req.supabase!.from('products').select('*', { count: 'exact', head: true }),
        _req.supabase!.from('product_variants').select('*', { count: 'exact', head: true }).eq('is_active', true),
        _req.supabase!.from('inventory_items').select('*', { count: 'exact', head: true }).eq('status', 'in_stock'),
        _req.supabase!.from('inventory_items').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
        _req.supabase!.from('inventory_items').select('*', { count: 'exact', head: true }).eq('status', 'warranty'),
        _req.supabase!.from('stock_movements')
          .select('id, movement_type, quantity, reference_note, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        _req.supabase!.from('product_variants')
          .select(`
            id, storage_gb, color, low_stock_threshold,
            product:product_id(model_name, brand:brand_id(name))
          `)
          .eq('is_active', true),
      ]);

      // Calcular stock bajo: variantes cuyo stock actual <= threshold
      const lowStockItems: any[] = [];

      if (variants && variants.length > 0) {
        // Obtener stock count para cada variante activa
        const countsPromises = variants.map((v: any) =>
          _req.supabase!.from('inventory_items')
            .select('*', { count: 'exact', head: true })
            .eq('variant_id', v.id)
            .eq('status', 'in_stock'),
        );

        const countsResults = await Promise.all(countsPromises);

        for (let i = 0; i < variants.length; i++) {
          const v = variants[i];
          const stockCount = countsResults[i].count ?? 0;
          if (stockCount <= v.low_stock_threshold) {
            lowStockItems.push({
              id: v.id,
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
          total_variants: totalVariants ?? 0,
          in_stock: inStock ?? 0,
          sold: soldCount ?? 0,
          warranty: warrantyCount ?? 0,
        },
        low_stock: lowStockItems.sort((a: any, b: any) => a.stock_count - b.stock_count),
        recent_movements: recentMovements ?? [],
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
      res.status(500).json({ error: 'Error al cargar estadísticas' });
    }
  });

  return router;
}
