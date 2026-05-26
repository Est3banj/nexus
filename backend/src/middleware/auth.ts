import { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role: 'admin' | 'employee';
        isActive: boolean;
      };
      supabase?: SupabaseClient;
    }
  }
}

export function authenticate(supabaseUrl: string, supabaseAnonKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.split(' ')[1];

      // Creamos UN SOLO cliente con el token del usuario
      // Así RLS reconoce al usuario autenticado
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        realtime: { transport: WebSocket as any },
      });

      // Verificamos el token con este mismo cliente
      const { data: { user }, error } = await userClient.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      // Consultamos el perfil — RLS permite porque auth.uid() = user.id
      const { data: profile, error: profileError } = await userClient
        .from('user_profiles')
        .select('role, is_active')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('Profile fetch error:', profileError);
        return res.status(403).json({ error: 'Account is inactive or profile not found' });
      }

      if (!profile.is_active) {
        return res.status(403).json({ error: 'Account is inactive' });
      }

      req.user = {
        id: user.id,
        email: user.email,
        role: profile.role,
        isActive: profile.is_active,
      };

      // Adjuntamos el cliente autenticado para los route handlers
      req.supabase = userClient;

      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(500).json({ error: 'Authentication failed' });
    }
  };
}
