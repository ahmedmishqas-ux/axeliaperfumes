-- AXELIAPERFUMES - PostgreSQL Schema for CranL
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name_ar VARCHAR(255) NOT NULL,
  brand VARCHAR(255) NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  old_price NUMERIC(10,2),
  category VARCHAR(100) NOT NULL,
  categories TEXT[] DEFAULT ARRAY['فاخر'],
  image_url TEXT,
  image_base64 TEXT,
  top_notes TEXT,
  heart_notes TEXT,
  base_notes TEXT,
  description TEXT,
  is_bestseller BOOLEAN DEFAULT false,
  is_new BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed 7 perfumes
INSERT INTO products (name_ar, brand, price, old_price, category, categories, top_notes, heart_notes, base_notes, description, is_bestseller) VALUES
('ألاسكا', 'أوزاريج', 118, 140, 'رجالي', ARRAY['رجالي','شتوي','فاخر'], 'هيل، مندارين، برغموت', 'قرفة، خزامى، فلفل وردي', 'فانيليا، تونكا، جلد، باتشولي', 'عطر شرقي خشبي فاخر - شتوي مسائي ثبات عالي', true),
('توندرا', 'أوزاريج', 120, 140, 'رجالي', ARRAY['رجالي','صيفي','فاخر'], 'برغموت، تفاح أخضر، نعناع', 'خزامى، قرفة، إبرة الراعي', 'خشب أرز، عنبر، مسك، جلد', 'عطر شرقي خشبي منعش', false),
('فيكتوريوسو ليجند', 'الهامبرا', 59, 75, 'رجالي', ARRAY['رجالي','فاخر'], 'جريب فروت، برغموت، تفاح', 'خزامى، قرفة، هيل', 'خشب صندل، عنبر، مسك، جلد', 'عطر خشبي فاخر رجالي', true),
('نفائس الشغف', 'الرصاصي', 110, 135, 'نسائي', ARRAY['نسائي','فاخر','عربي'], 'زعفران، ورد طائفي، ياسمين', 'عود، عنبر، خشب أرز', 'مسك، فانيليا، جلد', 'عطر شرقي فاخر', false),
('بوكيه ريد', 'زيمايا', 60, 90, 'نسائي', ARRAY['نسائي','فاخر'], 'زعفران، ياسمين', 'حلاوة غزل البنات، ورد', 'خشب أرز، عنبر، طحلب', 'بديل Baccarat Rouge 540 - حلو أنثوي جذاب', true),
('برستيج بلاك', 'الماجد للعود', 110, 145, 'للجنسين', ARRAY['للجنسين','فاخر','شتوي'], 'توت أحمر، برغموت', 'وردة، أوريس، ياسمين', 'خشب أرز، جلد، مسك، عنبر', 'عطر شرقي زهري فاخر', false),
('فيلوكي', 'ريفز RiiFFS', 110, 150, 'رجالي', ARRAY['رجالي','فاخر'], 'جريب فروت، ليمون إيطالي، برغموت', 'قرفة، كراميل، خزامى', 'خشب صندل، تونكا، المر الدخاني، مسك', 'خشبي حلو منعش - رجالي عصري', true);
