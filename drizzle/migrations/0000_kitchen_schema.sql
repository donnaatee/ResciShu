-- Personal app, no login (owner's decision). Open access to anon; revisit before sharing URL.
CREATE TABLE public.units (code text PRIMARY KEY, label text NOT NULL, dimension text NOT NULL CHECK (dimension IN ('weight','volume','count')), to_base numeric NOT NULL, system text NOT NULL DEFAULT 'us');
CREATE TABLE public.ingredients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), name text NOT NULL UNIQUE CHECK (name = lower(btrim(name)) AND name <> ''), category text NOT NULL DEFAULT 'other', default_unit text NOT NULL DEFAULT 'piece' REFERENCES public.units(code), est_price numeric, est_price_unit text REFERENCES public.units(code), is_staple boolean NOT NULL DEFAULT false);
CREATE TABLE public.inventory (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE, location text NOT NULL CHECK (location IN ('pantry','fridge','freezer')), quantity numeric NOT NULL DEFAULT 0, unit text NOT NULL REFERENCES public.units(code), low_stock_threshold numeric, expiration_date date, purchased_date date, notes text, UNIQUE (ingredient_id, location));
CREATE TABLE public.recipes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), name text NOT NULL, description text, photo_path text, prep_minutes int, cook_minutes int, servings numeric NOT NULL DEFAULT 4, category text NOT NULL DEFAULT 'dinner', instructions text[] NOT NULL DEFAULT '{}');
CREATE TABLE public.recipe_ingredients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE, ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE RESTRICT, quantity numeric, unit text REFERENCES public.units(code), prep_note text, sort_order int NOT NULL DEFAULT 0);
CREATE TABLE public.grocery_lists (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), name text NOT NULL, status text NOT NULL DEFAULT 'active', source text NOT NULL DEFAULT 'manual');
CREATE TABLE public.grocery_list_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), grocery_list_id uuid NOT NULL REFERENCES public.grocery_lists(id) ON DELETE CASCADE, ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE SET NULL, custom_name text, quantity numeric, unit text REFERENCES public.units(code), estimated_price numeric, is_purchased boolean NOT NULL DEFAULT false, added_manually boolean NOT NULL DEFAULT false);
CREATE TABLE public.meal_plans (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), plan_date date NOT NULL, meal_type text NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner')), recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE, servings numeric NOT NULL DEFAULT 2);

DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['units','ingredients','inventory','recipes','recipe_ingredients','grocery_lists','grocery_list_items','meal_plans'] LOOP
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('CREATE POLICY "open access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
END LOOP; END $$;

INSERT INTO public.units (code,label,dimension,to_base,system) VALUES
('g','g','weight',1,'metric'),('kg','kg','weight',1000,'metric'),('oz','oz','weight',28.3495,'us'),('lb','lb','weight',453.592,'us'),
('ml','ml','volume',1,'metric'),('l','L','volume',1000,'metric'),('tsp','tsp','volume',4.92892,'us'),('tbsp','tbsp','volume',14.7868,'us'),('fl_oz','fl oz','volume',29.5735,'us'),('cup','cup','volume',236.588,'us'),
('piece','piece','count',1,'us'),('can','can','count',1,'us'),('bunch','bunch','count',1,'us'),('clove','clove','count',1,'us');

INSERT INTO public.ingredients (name,category,default_unit,est_price,est_price_unit,is_staple) VALUES
('potatoes','produce','lb',1.2,'lb',false),('yellow onion','produce','piece',0.9,'piece',false),('garlic','produce','clove',0.15,'clove',false),('green onion','produce','bunch',1,'bunch',false),
('chicken thighs','meat','lb',3.5,'lb',false),('ground beef','meat','lb',5.5,'lb',false),('butter','dairy','oz',0.3,'oz',false),('milk','dairy','cup',0.25,'cup',false),('cheddar cheese','dairy','oz',0.4,'oz',false),('eggs','dairy','piece',0.33,'piece',false),
('all-purpose flour','grains','cup',0.15,'cup',false),('rice','grains','cup',0.3,'cup',false),('pasta','grains','lb',1.8,'lb',false),('crushed tomatoes','canned','can',1.6,'can',false),
('olive oil','condiments','tbsp',0.15,'tbsp',true),('salt','spices','tsp',0.01,'tsp',true),('black pepper','spices','tsp',0.05,'tsp',true),('frozen peas','frozen','cup',0.5,'cup',false);

INSERT INTO public.inventory (ingredient_id,location,quantity,unit,low_stock_threshold,expiration_date)
SELECT i.id, v.loc, v.q, v.u, v.th, CASE WHEN v.d IS NULL THEN NULL ELSE current_date + v.d END
FROM (VALUES ('potatoes','pantry',0.5,'lb',1.0,10),('yellow onion','pantry',3,'piece',2,20),('garlic','pantry',8,'clove',4,NULL),('chicken thighs','fridge',1.5,'lb',1,2),
('butter','fridge',4,'oz',4,30),('milk','fridge',2,'cup',2,4),('eggs','fridge',6,'piece',6,12),('cheddar cheese','fridge',1,'lb',4,14),('all-purpose flour','pantry',5,'lb',NULL,NULL),
('rice','pantry',3,'cup',2,NULL),('pasta','pantry',0,'lb',0.5,NULL),('olive oil','pantry',20,'tbsp',4,NULL),('salt','pantry',50,'tsp',5,NULL),('black pepper','pantry',10,'tsp',2,NULL),
('ground beef','freezer',1,'lb',1,60),('frozen peas','freezer',2,'cup',1,90)) AS v(n,loc,q,u,th,d)
JOIN public.ingredients i ON i.name = v.n;

INSERT INTO public.recipes (name,description,prep_minutes,cook_minutes,servings,category,instructions) VALUES
('Crispy roast potatoes','Golden, garlicky and crunchy.',10,45,4,'side',ARRAY['Heat oven to 425°F.','Cut potatoes into chunks and boil 8 minutes.','Drain, shake to rough up edges, toss with oil, garlic, salt.','Roast 35–40 minutes, turning once.']),
('Weeknight chicken & rice','One pan, very little washing up.',15,35,4,'dinner',ARRAY['Season chicken with salt and pepper.','Brown chicken in oil, set aside.','Soften onion and garlic, add rice and 2 cups water.','Nestle chicken on top, cover and simmer 25 minutes.','Stir in peas and rest 5 minutes.']),
('Cheesy potato bake','Comfort food for cold nights.',20,50,6,'dinner',ARRAY['Heat oven to 375°F.','Slice potatoes thinly.','Make a sauce with butter, flour and milk; melt in cheese.','Layer potatoes and sauce, bake 50 minutes.']),
('Spaghetti bolognese','A Sunday classic.',10,40,4,'dinner',ARRAY['Brown beef with onion and garlic.','Add crushed tomatoes and simmer 30 minutes.','Cook pasta and toss with sauce.']);

INSERT INTO public.recipe_ingredients (recipe_id,ingredient_id,quantity,unit,prep_note,sort_order)
SELECT r.id, i.id, v.q, v.u, v.note, v.o FROM (VALUES
('Crispy roast potatoes','potatoes',1,'lb','cut in chunks',1),('Crispy roast potatoes','olive oil',3,'tbsp',NULL,2),('Crispy roast potatoes','garlic',3,'clove','smashed',3),('Crispy roast potatoes','salt',1,'tsp',NULL,4),
('Weeknight chicken & rice','chicken thighs',1.5,'lb',NULL,1),('Weeknight chicken & rice','rice',1.5,'cup',NULL,2),('Weeknight chicken & rice','yellow onion',1,'piece','diced',3),('Weeknight chicken & rice','garlic',2,'clove','minced',4),('Weeknight chicken & rice','frozen peas',1,'cup',NULL,5),('Weeknight chicken & rice','black pepper',NULL,NULL,'to taste',6),
('Cheesy potato bake','potatoes',1,'lb','thinly sliced',1),('Cheesy potato bake','butter',2,'oz',NULL,2),('Cheesy potato bake','all-purpose flour',0.25,'cup',NULL,3),('Cheesy potato bake','milk',2,'cup',NULL,4),('Cheesy potato bake','cheddar cheese',8,'oz','grated',5),
('Spaghetti bolognese','ground beef',1,'lb',NULL,1),('Spaghetti bolognese','yellow onion',1,'piece','diced',2),('Spaghetti bolognese','garlic',2,'clove',NULL,3),('Spaghetti bolognese','crushed tomatoes',1,'can',NULL,4),('Spaghetti bolognese','pasta',1,'lb','spaghetti',5)
) AS v(rn,n,q,u,note,o) JOIN public.recipes r ON r.name=v.rn JOIN public.ingredients i ON i.name=v.n;