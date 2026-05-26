import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin, requireAuth } from '../middleware/roles';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;

export function createAuthRouter() {
  const router = Router();

  // GET /api/auth/me — get current user's profile and role
  router.get('/me', authenticate(supabaseUrl, supabaseAnonKey), requireAuth, (req, res) => {
    res.json({
      user: {
        id: req.user!.id,
        email: req.user!.email,
        role: req.user!.role,
        isActive: req.user!.isActive,
      }
    });
  });

  // GET /api/auth/users — list all users (admin only)
  router.get('/users', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { data, error } = await req.supabase!
      .from('user_profiles')
      .select('id, full_name, role, is_active, created_at');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    res.json({ users: data });
  });

  // PATCH /api/auth/users/:id/toggle — toggle user active status (admin only)
  router.patch('/users/:id/toggle', authenticate(supabaseUrl, supabaseAnonKey), requireAdmin, async (req, res) => {
    const { id } = req.params;

    const { data: user } = await req.supabase!
      .from('user_profiles')
      .select('is_active')
      .eq('id', id)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { error } = await req.supabase!
      .from('user_profiles')
      .update({ is_active: !user.is_active, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: 'Failed to update user' });
    }

    res.json({ message: 'User updated' });
  });

  return router;
}
