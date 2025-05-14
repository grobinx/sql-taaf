import fs from 'node:fs';
import { SqlAnalyzer } from '../SqlAnalyzer';
import { SqlAstBuilder } from '../SqlAstBuilder';
import { SqlTokenizer, Token } from '../SqlTokenizer';

let sql = `with szkielet as (
with all_date as (select * from generate_series('2019-08-31'::date, '2022-05-31'::date, '1 month') as dt),
recursive all_blzs (ikzs, blzs, nazw, nmbr) as ( select * from (with tab_knf as (select ikzs, blzs, nazw, rynk from omn.knf where ikzs=any(array[102613, 102614, 102615, 102616, 102617, 102618, 102619])),
tab_kdr as (select ikzs, blzs, nazw, min(nmbr) as nmbr from omn.kdr where ikzs=any(array[102613, 102614, 102615, 102616, 102617, 102618, 102619]) group by ikzs, blzs, nazw)
select f.ikzs, f.blzs, coalesce(r.nazw, f.nazw) as nazw, f.rynk, r.nmbr from tab_knf f left join tab_kdr r on f.ikzs=r.ikzs and f.blzs=r.blzs ) as v where ikzs is not null),
inwr_list as (select inwr, trej, nazw, regn as nwoj from mona.nwr where trej in ('00','lH','RD')),
rzs_list as (select coalesce(rzs.dtod, rn.DTOD) as dtod, coalesce(rzs.dtdo, rn.DTDO) as dtdo, WIDO, SORT, BLZS FROM OMN.RZS join omn.rpt_nzt rn using (irnt) where irnt in (764749, 764748, 764747, 764746, 764745, 764744, 764743)),
szablon_a as (select std.last_day(d.dt::date) as akdmr, b.ikzs, extract(year from d.dt::date) as NROK, extract(month from d.dt::date) AS MIES, extract(day from d.dt::date) as DZIEN, i.inwr, i.trej, i.nazw as rnazw, i.nwoj, b.nazw, b.rynk, b.nmbr, b.blzs from all_date d, inwr_list i, all_blzs b),
szablon_b as (select s.ikzs, s.akdmr, s.nrok, s.mies, s.dzien, s.inwr, s.trej, s.rnazw, s.nwoj, s.nazw, s.rynk, s.nmbr, s.blzs, coalesce(r.wido, 'T') as wido, r.dtod, r.dtdo, r.sort from szablon_a s left join rzs_list r on r.blzs=s.blzs)
select s.ikzs, s.akdmr, s.nrok, s.mies, s.dzien, s.inwr, s.trej, s.rnazw, s.nwoj, s.nazw as nazwa, s.rynk, s.nmbr, s.blzs, s.sort from szablon_b s where s.wido='T' and (s.dtod<='2022-05-31'::date or s.dtod is null) and (s.dtdo>='2019-08-31'::date or s.dtdo is null) and (s.dtod is null or s.akdmr>=s.dtod ) and (s.dtdo is null or s.akdmr<=s.dtdo )
),
dane_aiam as (select akdmr::date, blzs, inwr, pnmg, pnsp, pnzk from mona.aiam where akdmr between '2019-08-31'::date and '2022-05-31'::date and aktw=true and prod=1 and (akdmr = '2019-08-31'::date AND iagn = 49 OR akdmr = '2019-09-30'::date AND iagn = 49 OR akdmr = '2019-10-31'::date AND iagn = 49 OR akdmr = '2019-11-30'::date AND iagn = 49 OR akdmr = '2019-12-31'::date AND iagn = 49 OR akdmr = '2020-01-31'::date AND iagn = 49 OR akdmr = '2020-02-29'::date AND iagn = 49 OR akdmr = '2020-03-31'::date AND iagn = 49 OR akdmr = '2020-04-30'::date AND iagn = 49 OR akdmr = '2020-05-31'::date AND iagn = 49 OR akdmr = '2020-06-30'::date AND iagn = 49 OR akdmr = '2020-07-31'::date AND iagn = 49 OR akdmr = '2020-08-31'::date AND iagn = 49 OR akdmr = '2020-09-30'::date AND iagn = 49 OR akdmr = '2020-10-31'::date AND iagn = 49 OR akdmr = '2020-11-30'::date AND iagn = 49 OR akdmr = '2020-12-31'::date AND iagn = 49 OR akdmr = '2021-01-31'::date AND iagn = 49 OR akdmr = '2021-02-28'::date AND iagn = 49 OR akdmr = '2021-03-31'::date AND iagn = 49 OR akdmr = '2021-04-30'::date AND iagn = 49 OR akdmr = '2021-05-31'::date AND iagn = 49 OR akdmr = '2021-06-30'::date AND iagn = 49 OR akdmr = '2021-07-31'::date AND iagn = 49 OR akdmr = '2021-08-31'::date AND iagn = 49 OR akdmr = '2021-09-30'::date AND iagn = 49 OR akdmr = '2021-10-31'::date AND iagn = 49 OR akdmr = '2021-11-30'::date AND iagn = 49 OR akdmr = '2021-12-31'::date AND iagn = 49 OR akdmr = '2022-01-31'::date AND iagn = 49 OR akdmr = '2022-02-28'::date AND iagn = 49 OR akdmr = '2022-03-31'::date AND iagn = 49 OR akdmr = '2022-04-30'::date AND iagn = 49 OR akdmr = '2022-05-31'::date AND iagn = 49) and coalesce(idsw,0)=0 and inzt=any(array[73286, 73283, 73279, 73282, 73280, 73287, 73281])),
dane_ewum as (select akdmr::date, blzs, inwr, weis, wews from mona.ewum where akdmr between '2019-08-31'::date and '2022-05-31'::date and aktw=true and prod=1 and (akdmr = '2019-08-31'::date AND iagn = 49 OR akdmr = '2019-09-30'::date AND iagn = 49 OR akdmr = '2019-10-31'::date AND iagn = 49 OR akdmr = '2019-11-30'::date AND iagn = 49 OR akdmr = '2019-12-31'::date AND iagn = 49 OR akdmr = '2020-01-31'::date AND iagn = 49 OR akdmr = '2020-02-29'::date AND iagn = 49 OR akdmr = '2020-03-31'::date AND iagn = 49 OR akdmr = '2020-04-30'::date AND iagn = 49 OR akdmr = '2020-05-31'::date AND iagn = 49 OR akdmr = '2020-06-30'::date AND iagn = 49 OR akdmr = '2020-07-31'::date AND iagn = 49 OR akdmr = '2020-08-31'::date AND iagn = 49 OR akdmr = '2020-09-30'::date AND iagn = 49 OR akdmr = '2020-10-31'::date AND iagn = 49 OR akdmr = '2020-11-30'::date AND iagn = 49 OR akdmr = '2020-12-31'::date AND iagn = 49 OR akdmr = '2021-01-31'::date AND iagn = 49 OR akdmr = '2021-02-28'::date AND iagn = 49 OR akdmr = '2021-03-31'::date AND iagn = 49 OR akdmr = '2021-04-30'::date AND iagn = 49 OR akdmr = '2021-05-31'::date AND iagn = 49 OR akdmr = '2021-06-30'::date AND iagn = 49 OR akdmr = '2021-07-31'::date AND iagn = 49 OR akdmr = '2021-08-31'::date AND iagn = 49 OR akdmr = '2021-09-30'::date AND iagn = 49 OR akdmr = '2021-10-31'::date AND iagn = 49 OR akdmr = '2021-11-30'::date AND iagn = 49 OR akdmr = '2021-12-31'::date AND iagn = 49 OR akdmr = '2022-01-31'::date AND iagn = 49 OR akdmr = '2022-02-28'::date AND iagn = 49 OR akdmr = '2022-03-31'::date AND iagn = 49 OR akdmr = '2022-04-30'::date AND iagn = 49 OR akdmr = '2022-05-31'::date AND iagn = 49) and coalesce(idsw,0)=0 and inzt=any(array[73286, 73283, 73279, 73282, 73280, 73287, 73281])),
dane_siwm as (select akdmr::date, blzs, inwr, scsp, szkn, spil, ilzk, magz, spwr, zkwr, izkz from mona.siwm where akdmr between '2019-08-31'::date and '2022-05-31'::date and aktw=true and prod=1 and (akdmr = '2019-08-31'::date AND iagn = 49 OR akdmr = '2019-09-30'::date AND iagn = 49 OR akdmr = '2019-10-31'::date AND iagn = 49 OR akdmr = '2019-11-30'::date AND iagn = 49 OR akdmr = '2019-12-31'::date AND iagn = 49 OR akdmr = '2020-01-31'::date AND iagn = 49 OR akdmr = '2020-02-29'::date AND iagn = 49 OR akdmr = '2020-03-31'::date AND iagn = 49 OR akdmr = '2020-04-30'::date AND iagn = 49 OR akdmr = '2020-05-31'::date AND iagn = 49 OR akdmr = '2020-06-30'::date AND iagn = 49 OR akdmr = '2020-07-31'::date AND iagn = 49 OR akdmr = '2020-08-31'::date AND iagn = 49 OR akdmr = '2020-09-30'::date AND iagn = 49 OR akdmr = '2020-10-31'::date AND iagn = 49 OR akdmr = '2020-11-30'::date AND iagn = 49 OR akdmr = '2020-12-31'::date AND iagn = 49 OR akdmr = '2021-01-31'::date AND iagn = 49 OR akdmr = '2021-02-28'::date AND iagn = 49 OR akdmr = '2021-03-31'::date AND iagn = 49 OR akdmr = '2021-04-30'::date AND iagn = 49 OR akdmr = '2021-05-31'::date AND iagn = 49 OR akdmr = '2021-06-30'::date AND iagn = 49 OR akdmr = '2021-07-31'::date AND iagn = 49 OR akdmr = '2021-08-31'::date AND iagn = 49 OR akdmr = '2021-09-30'::date AND iagn = 49 OR akdmr = '2021-10-31'::date AND iagn = 49 OR akdmr = '2021-11-30'::date AND iagn = 49 OR akdmr = '2021-12-31'::date AND iagn = 49 OR akdmr = '2022-01-31'::date AND iagn = 49 OR akdmr = '2022-02-28'::date AND iagn = 49 OR akdmr = '2022-03-31'::date AND iagn = 49 OR akdmr = '2022-04-30'::date AND iagn = 49 OR akdmr = '2022-05-31'::date AND iagn = 49) and coalesce(idsw,0)=0 and inzt=any(array[73286, 73283, 73279, 73282, 73280, 73287, 73281])),
dane_umsz as (select akdmr::date, blzs, inwr, uisp, uizk, uwsp, uwzk from mona.umsz where akdmr between '2019-08-31'::date and '2022-05-31'::date and aktw=true and prod=1 and (akdmr = '2019-08-31'::date AND iagn = 49 OR akdmr = '2019-09-30'::date AND iagn = 49 OR akdmr = '2019-10-31'::date AND iagn = 49 OR akdmr = '2019-11-30'::date AND iagn = 49 OR akdmr = '2019-12-31'::date AND iagn = 49 OR akdmr = '2020-01-31'::date AND iagn = 49 OR akdmr = '2020-02-29'::date AND iagn = 49 OR akdmr = '2020-03-31'::date AND iagn = 49 OR akdmr = '2020-04-30'::date AND iagn = 49 OR akdmr = '2020-05-31'::date AND iagn = 49 OR akdmr = '2020-06-30'::date AND iagn = 49 OR akdmr = '2020-07-31'::date AND iagn = 49 OR akdmr = '2020-08-31'::date AND iagn = 49 OR akdmr = '2020-09-30'::date AND iagn = 49 OR akdmr = '2020-10-31'::date AND iagn = 49 OR akdmr = '2020-11-30'::date AND iagn = 49 OR akdmr = '2020-12-31'::date AND iagn = 49 OR akdmr = '2021-01-31'::date AND iagn = 49 OR akdmr = '2021-02-28'::date AND iagn = 49 OR akdmr = '2021-03-31'::date AND iagn = 49 OR akdmr = '2021-04-30'::date AND iagn = 49 OR akdmr = '2021-05-31'::date AND iagn = 49 OR akdmr = '2021-06-30'::date AND iagn = 49 OR akdmr = '2021-07-31'::date AND iagn = 49 OR akdmr = '2021-08-31'::date AND iagn = 49 OR akdmr = '2021-09-30'::date AND iagn = 49 OR akdmr = '2021-10-31'::date AND iagn = 49 OR akdmr = '2021-11-30'::date AND iagn = 49 OR akdmr = '2021-12-31'::date AND iagn = 49 OR akdmr = '2022-01-31'::date AND iagn = 49 OR akdmr = '2022-02-28'::date AND iagn = 49 OR akdmr = '2022-03-31'::date AND iagn = 49 OR akdmr = '2022-04-30'::date AND iagn = 49 OR akdmr = '2022-05-31'::date AND iagn = 49) and coalesce(idsw,0)=0 and inzt=any(array[73286, 73283, 73279, 73282, 73280, 73287, 73281]))
select DISTINCT s.akdmr as data, s.nrok, s.mies, s.dzien, s.inwr, s.nwoj, s.trej, s.rnazw, s.nazwa, s.rynk, s.nmbr, s.blzs, s.sort, coalesce(dane_ewum.weis,0) as weis, coalesce(dane_siwm.scsp,0) as scsp, coalesce(dane_siwm.szkn,0) as szkn, coalesce(dane_aiam.pnmg,0) as pnmg, coalesce(dane_ewum.wews,0) as wews, coalesce(dane_aiam.pnsp,0) as pnsp, coalesce(dane_aiam.pnzk,0) as pnzk, coalesce(dane_siwm.spil,0) as spil, coalesce(dane_siwm.ilzk,0) as ilzk, coalesce(dane_siwm.magz,0) as magz, coalesce(dane_umsz.uisp,0) as uisp, coalesce(dane_umsz.uizk,0) as uizk, coalesce(dane_umsz.uwsp,0) as uwsp, coalesce(dane_umsz.uwzk,0) as uwzk, coalesce(dane_siwm.spwr,0) as spwr, coalesce(dane_siwm.zkwr,0) as zkwr, coalesce(dane_siwm.izkz,0) as izkz
from szkielet s
left join dane_aiam on s.akdmr=dane_aiam.akdmr and s.blzs=dane_aiam.blzs and s.inwr=dane_aiam.inwr
left join dane_ewum on s.akdmr=dane_ewum.akdmr and s.blzs=dane_ewum.blzs and s.inwr=dane_ewum.inwr
left join dane_siwm on s.akdmr=dane_siwm.akdmr and s.blzs=dane_siwm.blzs and s.inwr=dane_siwm.inwr
left join dane_umsz on s.akdmr=dane_umsz.akdmr and s.blzs=dane_umsz.blzs and s.inwr=dane_umsz.inwr
ORDER BY data
`;

// sql = `select a.pid = pg_backend_pid() and (a.pid, b.pid), (select datname from pg_database where oid = a.datid) as database_name, 
//                a.usename user_name, a.application_name, coalesce(case when a.client_hostname = '' then null else a.client_hostname end, a.client_addr::text)||':'||a.client_port client_host,
//                a.backend_start, a.xact_start, query_start,
//                a.wait_event_type, a.wait_event,
//                a.backend_type,                state, case when state in ('active') then round(extract(epoch from now() -a.query_start)::numeric, 0) end runned, 
//                case when state in ('active') then to_char(now() -a.query_start, 'dd hh24:mi:ss') end runned_t, 
//                (select string_agg(kl.pid::text, ', ') from pg_catalog.pg_locks bl join pg_catalog.pg_locks kl on kl.transactionid = bl.transactionid and kl.pid != bl.pid where a.pid = bl.pid and not bl.granted) blocked_pid,
//                pg_stat_get_backend_activity(svrid) as query
//           from (select datid, pid pid, usename, application_name, client_addr, client_hostname, client_port, backend_start, xact_start, query_start, wait_event_type, wait_event, backend_type, state from pg_stat_activity) a
//                join pg_stat_get_backend_idset() svrid on a.pid = pg_stat_get_backend_pid(svrid)
// `;

sql = `select schema_name, table_name, owner_name, table_space, description, accessible, inheritance, quote_ident(schema_name)||'.'||quote_ident(table_name) full_object_name, table_name object_name,
       foreign_table
  from (select n.nspname as schema_name, c.relname as table_name, pg_catalog.pg_get_userbyid(c.relowner) as owner_name, 
               coalesce(t.spcname, (select spcname from pg_database d join pg_tablespace t on t.oid = d.dattablespace where d.datname = case when n.nspname in ('pg_catalog', 'information_schema') then 'postgres' else current_database() end)) as table_space,
               case
                 when pg_catalog.pg_has_role(c.relowner, 'USAGE') then 'USAGE'
                 when (select true from pg_catalog.aclexplode(c.relacl) g where grantee = 0 limit 1) then 'PUBLIC'
                 --when pg_catalog.has_table_privilege('public', c.oid, 'SELECT, INSERT, UPDATE, DELETE, REFERENCES') then 'BY PUBLIC ROLE' 
                 when pg_catalog.has_table_privilege(c.oid, 'SELECT, INSERT, UPDATE, DELETE') then 'GRANTED' 
                 when pg_catalog.has_any_column_privilege(c.oid, 'SELECT, INSERT, UPDATE') then 'COLUMN'
               else 'NO' end accessible,
               d.description,
               (select 'inherits' from pg_catalog.pg_inherits i where i.inhrelid = c.oid union all select 'inherited' from pg_catalog.pg_inherits i where i.inhparent = c.oid limit 1) inheritance
              ,case c.relkind when 'f'::"char" then 
                 (select coalesce(coalesce(coalesce(substring(ftoptions::varchar from '[{,]schema=([#$\w]+)'), substring(ftoptions::varchar from '[{,]schema_name=([#$\w]+)'))||'.', '')||coalesce(substring(ftoptions::varchar from '[{,"]table=(([#$\w]+)|\(.+\))[",}]'), substring(ftoptions::varchar from '[{,"]table_name=(([#$\w]+)|\(.+\))[",}]')), '') from pg_foreign_table f /*join pg_foreign_server s on f.ftserver = s.oid*/ where f.ftrelid = c.oid)
               end foreign_table
          from pg_catalog.pg_class c
               left join pg_catalog.pg_namespace n on n.oid = c.relnamespace
               left join pg_catalog.pg_tablespace t on t.oid = c.reltablespace
               left join pg_catalog.pg_description d on d.classoid = 'pg_class'::regclass and d.objoid = c.oid and d.objsubid = 0
         where c.relkind in ('r'::"char", 'f'::"char", 'p'::"char")) t
 where (schema_name = 'orbada' or (schema_name = any (current_schemas(false)) and 'orbada' = current_schema() and schema_name <> 'public'))
 order by schema_name, table_name
`

// sql = `select schema_name, table_name, ns.nspname function_schema_name, p.proname function_name, pg_get_function_arguments(p.oid) function_arguments,
//        array_to_string(array(select tgname from pg_catalog.pg_trigger t where f.foid = t.tgfoid and f.coid = t.tgrelid), ', ') triggers,
//        p.proname||'('||coalesce(pg_get_function_identity_arguments(p.oid), '')||')' full_function_name,
//        p.proname||'('||coalesce(pg_get_function_identity_arguments(p.oid), '')||')' object_name
//   from (select schema_name, table_name, foid, coid
//           from (select distinct ns.nspname schema_name, c.relname table_name, t.tgfoid foid, c.oid coid
//                   from pg_catalog.pg_trigger t
//                        join pg_catalog.pg_class c on c.oid = t.tgrelid
//                        join pg_catalog.pg_namespace ns on ns.oid = c.relnamespace
//                  where not t.tgisinternal
//                    and not pg_is_other_temp_schema(ns.oid)) t) f
//        join pg_catalog.pg_proc p on p.oid = f.foid
//        join pg_catalog.pg_namespace ns on ns.oid = p.pronamespace
//  order by function_name
// `
// sql = `select b.blz7, b.mhid, b.nmid, a.nazwa_leku AS nazw
//           from (select *
//                   from public.dblink(get_autonomous_auth_host('abdpgmaster1'::text), 
//                     'select blz7, nale||'' ''||napo||'' ''||nada||'' ''||naop as nazwa_leku 
//                        from bloz.v_pg_omn_nazw_leki') as t (blz7 integer, nazwa_leku text)) AS a
//           join omn.v_leki AS b USING(blz7)
//          where b.nrok = 2020 and b.mies = 12`

const parser = new SqlTokenizer();
const tokens = parser.parse(sql);

const ast = new SqlAstBuilder().build(tokens);

if (ast) {
    const analyzer = new SqlAnalyzer(ast);
    // console.log(analyzer.findDependencyAt(410));
    console.log('Used relations:');
    let relations = analyzer.findUsedRelations();
    console.log(relations);
    console.log('Relations columns:');
    console.log(analyzer.resolveRelationColumns(...relations));
    console.log('Relations at:');
    relations = analyzer.findRelationsAt(1010);
    console.log(relations);
    console.log('Relations columns at:');
    console.log(analyzer.resolveRelationColumns(...relations));
    // console.log(analyzer.ownerStatementColumns(1010));
    // console.log(analyzer.findRelationAliasAt('f', 224));
    // console.log(analyzer.findColumnsAt(8989));

    // const formatter = new SqlFormatter();
    // console.log(formatter.format(tokens));
} else {
    console.error('AST is null. Cannot analyze.');
}


function removeTokensFromAst(ast: any): any {
    if (Array.isArray(ast)) {
        return ast.map(removeTokensFromAst);
    } else if (typeof ast === 'object' && ast !== null) {
        const { tokens, ...rest } = ast; // Usuń właściwość `tokens`
        const newAst = { ...rest };
        for (const key in newAst) {
            if (newAst.hasOwnProperty(key)) {
                newAst[key] = removeTokensFromAst(newAst[key]); // Rekurencyjnie przetwarzaj poddrzewa
            }
        }
        return newAst;
    }
    return ast; // Zwróć wartość, jeśli nie jest obiektem ani tablicą
}

console.log(ast);
//fs.writeFileSync('doc/tokens.json', JSON.stringify(tokens, null, 2));
//fs.writeFileSync('doc/ast.json', JSON.stringify(removeTokensFromAst(ast), null, 2));

console.log('------------------');