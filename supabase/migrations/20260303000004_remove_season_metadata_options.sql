-- Seasons are fixed options and should not be user-customizable.

delete from public.item_metadata_options
where category = 'season';

alter table public.item_metadata_options
  drop constraint if exists item_metadata_options_category_valid;

alter table public.item_metadata_options
  add constraint item_metadata_options_category_valid
  check (category in ('brand', 'clothing_type', 'color', 'material'));
