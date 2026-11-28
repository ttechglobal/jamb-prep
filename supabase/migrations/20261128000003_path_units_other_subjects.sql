-- Path units for Biology, Accounting, Commerce and Economics, grouped so every unit holds at least
-- 20 distinct published questions (counts as of writing).
--   Biology:    21 topics in  9 units (31 to 58 questions)
--   Accounting: 18 topics in 10 units (21 to 139)
--   Commerce:   16 topics in 10 units (21 to 80)
--   Economics:  23 topics in 10 units (26 to 65)
-- Order and names are data: edit a row to change the path.

-- Biology ---------------------------------------------------------------------

with u(slug, name, sort_order) as (values
  ('living-organisms-classification', 'Living organisms, cells and classification', 10),
  ('adaptations-internal-structure', 'Adaptations and internal structure', 30),
  ('nutrition', 'Nutrition', 50),
  ('transport-respiration-excretion', 'Transport, respiration and excretion', 60),
  ('support-reproduction-growth', 'Support, reproduction and growth', 90),
  ('coordination-control', 'Co-ordination and control', 120),
  ('habitats-distribution-soil', 'Habitats, distribution and soil', 130),
  ('symbiosis-humans-environment', 'Symbiosis and humans in the environment', 140),
  ('genetics-evolution', 'Variation, heredity and evolution', 190)
)
insert into public.path_units (subject_id, slug, name, sort_order)
select 'biology', slug, name, sort_order from u;

with m(unit_slug, topic_slug) as (values
  ('living-organisms-classification', 'living-organisms-characteristics-cell-structure-and-levels-of-organization'),
  ('living-organisms-classification', 'evolution-and-classification-among-the-kingdoms'),
  ('adaptations-internal-structure', 'structural-functional-and-behavioural-adaptations-of-organisms'),
  ('adaptations-internal-structure', 'internal-structure-of-flowering-plants-and-mammals'),
  ('nutrition', 'nutrition'),
  ('transport-respiration-excretion', 'transport'),
  ('transport-respiration-excretion', 'respiration'),
  ('transport-respiration-excretion', 'excretion'),
  ('support-reproduction-growth', 'support-and-movement'),
  ('support-reproduction-growth', 'reproduction'),
  ('support-reproduction-growth', 'growth'),
  ('coordination-control', 'co-ordination-and-control'),
  ('habitats-distribution-soil', 'factors-affecting-the-distribution-of-organisms'),
  ('habitats-distribution-soil', 'natural-habitats-and-local-nigerian-biomes'),
  ('habitats-distribution-soil', 'ecology-of-populations'),
  ('habitats-distribution-soil', 'soil'),
  ('symbiosis-humans-environment', 'symbiotic-interactions-energy-flow-and-nutrient-cycling'),
  ('symbiosis-humans-environment', 'humans-and-environment'),
  ('genetics-evolution', 'variation-in-population'),
  ('genetics-evolution', 'heredity'),
  ('genetics-evolution', 'evolution')
)
insert into public.path_unit_topics (unit_id, topic_id)
select pu.id, t.id
from m
join public.path_units pu on pu.subject_id = 'biology' and pu.slug = m.unit_slug
join public.topics t on t.subject_id = 'biology' and t.slug = m.topic_slug;

-- Accounting ------------------------------------------------------------------

with u(slug, name, sort_order) as (values
  ('nature-of-accounting-ethics', 'Nature of accounting and ethics', 10),
  ('double-entry', 'Principles of double entry', 20),
  ('cash-book-banking', 'Cash book and bank reconciliation', 40),
  ('sole-trader-final-accounts', 'Final accounts of a sole trader', 60),
  ('stock-control-accounts', 'Stock valuation and control accounts', 70),
  ('incomplete-records-non-profit', 'Incomplete records and non-profit accounts', 90),
  ('manufacturing-accounts', 'Manufacturing accounts', 100),
  ('departmental-branch-joint-venture', 'Departmental, branch and joint venture accounts', 120),
  ('partnership-accounts', 'Partnership accounts', 150),
  ('company-public-sector', 'Company and public sector accounts', 160)
)
insert into public.path_units (subject_id, slug, name, sort_order)
select 'accounting', slug, name, sort_order from u;

with m(unit_slug, topic_slug) as (values
  ('nature-of-accounting-ethics', 'nature-and-significance-of-book-keeping-and-accounting'),
  ('nature-of-accounting-ethics', 'ethics-professional-and-regulatory-bodies-in-accounting'),
  ('double-entry', 'principles-of-double-entry'),
  ('cash-book-banking', 'cash-book'),
  ('cash-book-banking', 'bank-transactions-and-reconciliation-statements'),
  ('sole-trader-final-accounts', 'final-accounts-of-a-sole-trader-proprietor'),
  ('stock-control-accounts', 'stock-valuation'),
  ('stock-control-accounts', 'control-accounts'),
  ('incomplete-records-non-profit', 'incomplete-records-and-single-entry'),
  ('incomplete-records-non-profit', 'accounts-of-not-for-profit-making-organizations'),
  ('manufacturing-accounts', 'manufacturing-accounts'),
  ('departmental-branch-joint-venture', 'departmental-accounts'),
  ('departmental-branch-joint-venture', 'branch-accounts'),
  ('departmental-branch-joint-venture', 'joint-venture-accounts'),
  ('partnership-accounts', 'partnership-accounts'),
  ('company-public-sector', 'introduction-to-company-accounts'),
  ('company-public-sector', 'public-sector-accounting'),
  ('company-public-sector', 'information-technology-in-accounting')
)
insert into public.path_unit_topics (unit_id, topic_id)
select pu.id, t.id
from m
join public.path_units pu on pu.subject_id = 'accounting' and pu.slug = m.unit_slug
join public.topics t on t.subject_id = 'accounting' and t.slug = m.topic_slug;

-- Commerce --------------------------------------------------------------------

with u(slug, name, sort_order) as (values
  ('commerce-occupation-production', 'Commerce, occupation and production', 10),
  ('trade-and-sale-of-goods', 'Trade and the sale of goods', 40),
  ('aids-to-trade', 'Aids to trade', 60),
  ('business-units-associations', 'Business units and trade associations', 70),
  ('money-and-financing', 'Money and financing business', 80),
  ('exchanges', 'Stock and commodity exchanges', 110),
  ('management', 'Elements of business management', 120),
  ('marketing', 'Elements of marketing', 130),
  ('legal-aspects', 'Legal aspects of business', 140),
  ('business-environment', 'Business environment and social responsibility', 160)
)
insert into public.path_units (subject_id, slug, name, sort_order)
select 'commerce', slug, name, sort_order from u;

with m(unit_slug, topic_slug) as (values
  ('commerce-occupation-production', 'commerce'),
  ('commerce-occupation-production', 'occupation'),
  ('commerce-occupation-production', 'production'),
  ('trade-and-sale-of-goods', 'trade'),
  ('trade-and-sale-of-goods', 'purchase-and-sale-of-goods'),
  ('aids-to-trade', 'aids-to-trade'),
  ('business-units-associations', 'business-units'),
  ('business-units-associations', 'trade-associations'),
  ('money-and-financing', 'financing-business'),
  ('money-and-financing', 'money'),
  ('exchanges', 'stock-exchange'),
  ('exchanges', 'commodity-exchange'),
  ('management', 'elements-of-business-management'),
  ('marketing', 'elements-of-marketing'),
  ('legal-aspects', 'legal-aspects-of-business'),
  ('business-environment', 'business-environment-and-social-responsibility')
)
insert into public.path_unit_topics (unit_id, topic_id)
select pu.id, t.id
from m
join public.path_units pu on pu.subject_id = 'commerce' and pu.slug = m.unit_slug
join public.topics t on t.subject_id = 'commerce' and t.slug = m.topic_slug;

-- Economics -------------------------------------------------------------------

with u(slug, name, sort_order) as (values
  ('economics-basics', 'Economics as a science, systems and tools', 10),
  ('demand-consumer', 'Demand and consumer behaviour', 40),
  ('supply-price', 'Supply and price determination', 60),
  ('production-costs', 'Production, costs and revenue', 80),
  ('market-structures', 'Market structures', 100),
  ('income-money-inflation', 'National income, money and inflation', 110),
  ('finance-public-finance', 'Financial institutions and public finance', 130),
  ('growth-population', 'Growth, development and population', 150),
  ('nigerian-economy', 'The Nigerian economy and business', 160),
  ('international', 'International trade and organizations', 210)
)
insert into public.path_units (subject_id, slug, name, sort_order)
select 'economics', slug, name, sort_order from u;

with m(unit_slug, topic_slug) as (values
  ('economics-basics', 'economics-as-a-science'),
  ('economics-basics', 'economic-systems'),
  ('economics-basics', 'methods-and-tools-of-economic-analysis'),
  ('demand-consumer', 'the-theory-of-demand'),
  ('demand-consumer', 'the-theory-of-consumer-behaviour'),
  ('supply-price', 'the-theory-of-supply'),
  ('supply-price', 'the-theory-of-price-determination'),
  ('production-costs', 'the-theory-of-production'),
  ('production-costs', 'theory-of-costs-and-revenue'),
  ('production-costs', 'factors-of-production-and-their-theories'),
  ('market-structures', 'market-structures'),
  ('income-money-inflation', 'national-income'),
  ('income-money-inflation', 'money-and-inflation'),
  ('finance-public-finance', 'financial-institutions'),
  ('finance-public-finance', 'public-finance'),
  ('growth-population', 'economic-growth-and-development'),
  ('growth-population', 'population'),
  ('nigerian-economy', 'agriculture-in-nigeria'),
  ('nigerian-economy', 'industry-and-industrialization'),
  ('nigerian-economy', 'natural-resources-and-the-nigerian-economy'),
  ('nigerian-economy', 'business-organizations'),
  ('international', 'international-trade'),
  ('international', 'international-economic-organizations')
)
insert into public.path_unit_topics (unit_id, topic_id)
select pu.id, t.id
from m
join public.path_units pu on pu.subject_id = 'economics' and pu.slug = m.unit_slug
join public.topics t on t.subject_id = 'economics' and t.slug = m.topic_slug;

do $$
declare
  r record;
begin
  for r in
    select s.subject_id, s.expected, (
      select count(*) from public.path_unit_topics put join public.path_units pu on pu.id = put.unit_id where pu.subject_id = s.subject_id
    ) as found
    from (values ('biology', 21), ('accounting', 18), ('commerce', 16), ('economics', 23)) as s(subject_id, expected)
  loop
    if r.found <> r.expected then
      raise exception '% units must cover all % topics, found %', r.subject_id, r.expected, r.found;
    end if;
  end loop;
end;
$$;
