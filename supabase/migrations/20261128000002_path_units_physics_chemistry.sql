-- Path units for Physics and Chemistry, grouped like Maths so every unit holds enough questions for
-- rounds on different days. Counts are distinct published questions when this was written.
--   Physics:   38 topics in 14 units (24 to 111 questions each)
--   Chemistry: 18 topics in 10 units (45 to 153 questions each)
-- Order and names are data: edit a row to change the path.

-- Physics ---------------------------------------------------------------------

with u(slug, name, sort_order) as (values
  ('measurements-and-motion', 'Measurements and motion', 10),
  ('gravity-forces-machines', 'Gravity, forces and machines', 30),
  ('work-energy-power', 'Work, energy and power', 60),
  ('pressure-and-liquids', 'Pressure and liquids', 90),
  ('temperature-and-heat', 'Temperature and heat', 110),
  ('gases-matter-heat-transfer', 'Gases, matter and heat transfer', 150),
  ('waves-and-sound', 'Waves and sound', 190),
  ('light-reflection-refraction', 'Light: reflection and refraction', 220),
  ('optical-instruments-colour', 'Optical instruments and colour', 250),
  ('electrostatics-capacitors', 'Electrostatics and capacitors', 270),
  ('current-electricity', 'Current electricity', 290),
  ('magnetism-induction', 'Magnetism and induction', 320),
  ('conduction-electronics', 'Conduction and electronics', 360),
  ('modern-physics', 'Modern physics', 370)
)
insert into public.path_units (subject_id, slug, name, sort_order)
select 'physics', slug, name, sort_order from u;

with m(unit_slug, topic_slug) as (values
  ('measurements-and-motion', 'measurements-and-units'),
  ('measurements-and-motion', 'motion'),
  ('gravity-forces-machines', 'gravitational-field'),
  ('gravity-forces-machines', 'equilibrium-of-forces'),
  ('gravity-forces-machines', 'friction'),
  ('gravity-forces-machines', 'simple-machines'),
  ('gravity-forces-machines', 'elasticity'),
  ('work-energy-power', 'work-energy-and-power'),
  ('pressure-and-liquids', 'pressure'),
  ('pressure-and-liquids', 'liquids-at-rest'),
  ('temperature-and-heat', 'temperature-and-its-measurement'),
  ('temperature-and-heat', 'quantity-of-heat'),
  ('temperature-and-heat', 'change-of-state'),
  ('temperature-and-heat', 'thermal-expansion'),
  ('temperature-and-heat', 'vapours'),
  ('gases-matter-heat-transfer', 'gas-laws'),
  ('gases-matter-heat-transfer', 'structure-of-matter-and-kinetic-theory'),
  ('gases-matter-heat-transfer', 'heat-transfer'),
  ('waves-and-sound', 'waves'),
  ('waves-and-sound', 'propagation-of-sound-waves'),
  ('waves-and-sound', 'characteristics-of-sound-waves'),
  ('light-reflection-refraction', 'light-energy'),
  ('light-reflection-refraction', 'reflection-of-light-at-plane-and-curved-surfaces'),
  ('light-reflection-refraction', 'refraction-of-light-through-plane-and-curved-surfaces'),
  ('optical-instruments-colour', 'optical-instruments'),
  ('optical-instruments-colour', 'dispersion-of-light-and-colours'),
  ('electrostatics-capacitors', 'electrostatics'),
  ('electrostatics-capacitors', 'capacitors'),
  ('current-electricity', 'electric-cells'),
  ('current-electricity', 'current-electricity'),
  ('current-electricity', 'electrical-energy-and-power'),
  ('magnetism-induction', 'magnets-and-magnetic-fields'),
  ('magnetism-induction', 'force-on-a-current-carrying-conductor-in-a-magnetic-field'),
  ('magnetism-induction', 'electromagnetic-induction'),
  ('magnetism-induction', 'simple-a-c-circuits'),
  ('conduction-electronics', 'conduction-of-electricity-through-liquids-and-gases'),
  ('conduction-electronics', 'introductory-electronics'),
  ('modern-physics', 'elementary-modern-physics')
)
insert into public.path_unit_topics (unit_id, topic_id)
select pu.id, t.id
from m
join public.path_units pu on pu.subject_id = 'physics' and pu.slug = m.unit_slug
join public.topics t on t.subject_id = 'physics' and t.slug = m.topic_slug;

-- Chemistry -------------------------------------------------------------------

with u(slug, name, sort_order) as (values
  ('separation-and-combination', 'Separation and chemical combination', 10),
  ('kinetic-theory-gas-laws', 'Kinetic theory and gas laws', 30),
  ('atomic-structure-bonding', 'Atomic structure and bonding', 40),
  ('solubility-pollution', 'Solubility and environmental pollution', 60),
  ('acids-bases-salts', 'Acids, bases and salts', 80),
  ('redox-electrolysis', 'Redox and electrolysis', 90),
  ('energy-rates-equilibria', 'Energy, rates and equilibria', 110),
  ('non-metals', 'Non-metals and their compounds', 140),
  ('metals-industry', 'Metals, compounds and industry', 150),
  ('organic-compounds', 'Organic compounds', 160)
)
insert into public.path_units (subject_id, slug, name, sort_order)
select 'chemistry', slug, name, sort_order from u;

with m(unit_slug, topic_slug) as (values
  ('separation-and-combination', 'separation-of-mixtures-and-purification-of-chemical-substances'),
  ('separation-and-combination', 'chemical-combination'),
  ('kinetic-theory-gas-laws', 'kinetic-theory-of-matter-and-gas-laws'),
  ('atomic-structure-bonding', 'atomic-structure-and-bonding'),
  ('atomic-structure-bonding', 'nuclear-chemistry'),
  ('atomic-structure-bonding', 'astronomical-chemistry'),
  ('solubility-pollution', 'solubility'),
  ('solubility-pollution', 'environmental-pollution'),
  ('acids-bases-salts', 'acids-bases-and-salts'),
  ('redox-electrolysis', 'oxidation-and-reduction-redox'),
  ('redox-electrolysis', 'electrolysis'),
  ('energy-rates-equilibria', 'energy-changes'),
  ('energy-rates-equilibria', 'rates-of-chemical-reaction'),
  ('energy-rates-equilibria', 'chemical-equilibria'),
  ('non-metals', 'non-metals-and-their-compounds'),
  ('metals-industry', 'metals-and-their-compounds'),
  ('metals-industry', 'chemistry-and-industry'),
  ('organic-compounds', 'organic-compounds')
)
insert into public.path_unit_topics (unit_id, topic_id)
select pu.id, t.id
from m
join public.path_units pu on pu.subject_id = 'chemistry' and pu.slug = m.unit_slug
join public.topics t on t.subject_id = 'chemistry' and t.slug = m.topic_slug;

do $$
declare
  v_physics int;
  v_chemistry int;
begin
  select count(*) into v_physics from public.path_unit_topics put join public.path_units pu on pu.id = put.unit_id where pu.subject_id = 'physics';
  select count(*) into v_chemistry from public.path_unit_topics put join public.path_units pu on pu.id = put.unit_id where pu.subject_id = 'chemistry';
  if v_physics <> 38 then
    raise exception 'Physics units must cover all 38 topics, found %', v_physics;
  end if;
  if v_chemistry <> 18 then
    raise exception 'Chemistry units must cover all 18 topics, found %', v_chemistry;
  end if;
end;
$$;
