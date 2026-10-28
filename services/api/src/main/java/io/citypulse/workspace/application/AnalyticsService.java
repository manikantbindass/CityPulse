package io.citypulse.workspace.application;

import io.citypulse.identity.TenantContext;
import io.citypulse.workspace.infrastructure.WorkspaceRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly=true)
public class AnalyticsService {
    private final WorkspaceRepository db;private final TenantContext tenant;
    public AnalyticsService(WorkspaceRepository db,TenantContext tenant){this.db=db;this.tenant=tenant;}
    public Map<String,Object> metrics(UUID city,String commodity,String unit,Instant from,Instant to){
        if(!to.isAfter(from)||Duration.between(from,to).toDays()>366)throw new IllegalArgumentException("Use a positive window up to 366 days");
        var p=new MapSqlParameterSource("tenant",tenant.tenantId()).addValue("city",city).addValue("commodity",commodity).addValue("unit",unit).addValue("from",java.sql.Timestamp.from(from)).addValue("to",java.sql.Timestamp.from(to));
        if(db.query("SELECT city_id FROM tenant_city WHERE tenant_id=:tenant AND city_id=:city",p).isEmpty())throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND,"City not found");
        String filtered=" FROM observation o JOIN source_metadata s ON s.id=o.source_id AND s.tenant_id=o.tenant_id WHERE o.tenant_id=:tenant AND o.city_id=:city AND o.commodity=:commodity AND o.unit=:unit AND o.observed_at>=:from AND o.observed_at<:to ";
        var summary=db.query("WITH totals AS (SELECT s.data_mode,extract(epoch from (period_end-observed_at)) AS interval_seconds,SUM(CASE WHEN kind='demand' THEN quantity ELSE 0 END) AS demand,SUM(CASE WHEN kind='supply' THEN quantity ELSE 0 END) AS supply,COUNT(*) AS observations"+filtered+"GROUP BY s.data_mode,interval_seconds) SELECT *,demand/NULLIF(supply,0) AS demand_supply_ratio,GREATEST(demand-supply,0) AS shortage,GREATEST(supply-demand,0) AS surplus,GREATEST(demand-supply,0)/NULLIF(demand,0) AS market_gap_share FROM totals",p);
        var temporal=db.query("SELECT s.data_mode,date_trunc('day',observed_at AT TIME ZONE 'UTC') AS utc_day,extract(epoch from (period_end-observed_at)) AS interval_seconds,SUM(CASE WHEN kind='demand' THEN quantity ELSE 0 END) AS demand,SUM(CASE WHEN kind='supply' THEN quantity ELSE 0 END) AS supply"+filtered+"GROUP BY s.data_mode,utc_day,interval_seconds ORDER BY utc_day LIMIT 1000",p);
        var volatility=db.query("WITH daily AS (SELECT s.data_mode,date_trunc('day',observed_at AT TIME ZONE 'UTC') AS day,extract(epoch from (period_end-observed_at)) AS interval_seconds,SUM(quantity) AS demand"+filtered+"AND kind='demand' GROUP BY s.data_mode,day,interval_seconds) SELECT data_mode,interval_seconds,stddev_pop(demand) AS stddev,avg(demand) AS mean,stddev_pop(demand)/NULLIF(avg(demand),0) AS coefficient_of_variation FROM daily GROUP BY data_mode,interval_seconds",p);
        var categories=db.query("SELECT COALESCE(b.category,'unassigned') AS category,s.data_mode,o.unit,SUM(o.quantity) AS demand FROM observation o JOIN source_metadata s ON s.id=o.source_id AND s.tenant_id=o.tenant_id LEFT JOIN business b ON b.id=o.business_id AND b.tenant_id=o.tenant_id WHERE o.tenant_id=:tenant AND o.city_id=:city AND o.commodity=:commodity AND o.unit=:unit AND o.kind='demand' AND o.observed_at>=:from AND o.observed_at<:to GROUP BY category,s.data_mode,o.unit",p);
        var density=db.query("SELECT b.category,count(*) AS businesses,count(*)/NULLIF(ST_Area(c.boundary::geography)/1000000.0,0) AS businesses_per_square_km FROM business b JOIN city c ON c.id=b.city_id WHERE b.tenant_id=:tenant AND b.city_id=:city GROUP BY b.category,c.boundary",p);
        var access=db.query("SELECT count(*) AS businesses_with_neighbor_within_1km FROM business b WHERE b.tenant_id=:tenant AND b.city_id=:city AND EXISTS(SELECT 1 FROM business other WHERE other.tenant_id=:tenant AND other.city_id=:city AND other.id<>b.id AND ST_DWithin(b.location::geography,other.location::geography,1000))",p);
        var clusters=db.query("WITH projected AS (SELECT id,ST_Transform(b.location,(CASE WHEN ST_Y(ST_Centroid(c.boundary))>=0 THEN 32600 ELSE 32700 END)+(floor((ST_X(ST_Centroid(c.boundary))+180)/6)::integer+1)) AS point FROM business b JOIN city c ON c.id=b.city_id WHERE b.tenant_id=:tenant AND b.city_id=:city AND abs(ST_Y(b.location))<80), assigned AS (SELECT id,ST_ClusterDBSCAN(point,eps:=1000,minpoints:=2) OVER(ORDER BY id) AS cluster FROM projected) SELECT cluster,count(*) AS businesses FROM assigned GROUP BY cluster ORDER BY cluster NULLS LAST",p);
        return Map.of("categoryDemand",categories,"summary",summary,"dailyUtc",temporal,"demandVolatility",volatility,"businessDensity",density,"accessibilityProxy",access,"geographicClusters",clusters,"limitations",java.util.List.of("Missing observations are unknown, not confirmed zero","Business-neighbor proximity is not population accessibility","Density uses registered business records and geodesic city area","DBSCAN uses local UTM and is intended for small cities within one UTM zone","Daily buckets use UTC; compare local calendar effects separately","No capacity or population dataset: utilization and resident accessibility are not inferred"));
    }
}
