import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

export function createUploadRouter() {
  const router = Router();

  router.post('/', async (req, res) => {
    const { image, filename } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    try {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const finalFilename = filename || `${Date.now()}.jpg`;
      const filePath = `products/${finalFilename}`;

      const key = supabaseServiceKey || supabaseAnonKey;
      const supabase = createClient(supabaseUrl, key);

      const { error } = await supabase.storage
        .from('product-images')
        .upload(filePath, buffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      res.json({ url: publicUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
