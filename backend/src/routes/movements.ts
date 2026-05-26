import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export function createMovementsRouter() {
  const router = Router();

  // GET /api/movements — all stock movements (admin only)
  router.get('/', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { limit = '50', offset = '0', variant_id } = req.query;

    let query = req.supabase!
      .from('stock_movements')
      .select(`
        id, movement_type, quantity, reference_note, performed_by, inventory_item_id, created_at,
        variant:variant_id(storage_gb, color, product:product_id(model_name, brand:brand_id(name)))
      `, { count: 'exact' });

    if (variant_id) {
      query = query.eq('variant_id', variant_id);
    }

    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offsetNum = parseInt(offset as string, 10);

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offsetNum, offsetNum + limitNum - 1);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ movements: data, total: count });
  });

  return router;
}
