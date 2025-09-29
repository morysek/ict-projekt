sql
-- create the table
create table if not exists clicks (
id serial primary key,
total bigint not null default 0
);


-- ensure there is a single row we will update (id = 1)
insert into clicks (id, total)
values (1, 0)
on conflict (id) do nothing;


-- create a safe RPC to increment and return the new value
create or replace function increment_clicks()
returns bigint
language plpgsql
as $$
declare
new_total bigint;
begin
update clicks
set total = total + 1
where id = 1
returning total into new_total;
return new_total;
end;
$$;
