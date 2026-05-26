import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/roles';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export function createBrandsRouter() {
  const router = Router();

  // GET /api/brands — list all active brands
  router.get('/', authenticate(supabaseUrl, supabaseAnonKey), async (req, res) => {
    const { data, error } = await req.supabase!
      .from('brands')
      .select('id, name, slug, is_active, created_at')
      .order('name');

    if (error) return res.status(500).json({ error: error.message });
    res.json({ brands: data });
  });

  // GET /api/brands/:id — get single brand
  router.get('/:id', authenticate(supabaseUrl, supabaseAnonKey), async (req, res) => {
    const { data, error } = await req.supabase!
      .from('brands')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) return res.status(404).json({ error: 'Brand not found' });
    res.json({ brand: data });
  });

  // POST /api/brands — create brand (admin only)
  router.post('/', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Brand name is required' });
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const { data, error } = await req.supabase!
      .from('brands')
      .insert({ name: name.trim(), slug })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Brand already exists' });
      }
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ brand: data });
  });

  // PUT /api/brands/:id — update brand (admin only)
  router.put('/:id', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { name, is_active } = req.body;
    const updates: Record<string, any> = {};

    if (name?.trim()) {
      updates.name = name.trim();
      updates.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    if (typeof is_active === 'boolean') updates.is_active = is_active;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await req.supabase!
      .from('brands')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ brand: data });
  });

  return router;
}
