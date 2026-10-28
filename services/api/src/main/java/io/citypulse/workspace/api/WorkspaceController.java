package io.citypulse.workspace.api;

import io.citypulse.workspace.application.AccountService;
import io.citypulse.workspace.application.WorkspaceService;
import io.citypulse.workspace.domain.Account;
import io.citypulse.workspace.domain.WorkspaceModels.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
@Validated
public class WorkspaceController {
    private final WorkspaceService service;private final AccountService accounts;private final ObjectMapper json;private final Validator validator;
    public WorkspaceController(WorkspaceService service,AccountService accounts,ObjectMapper json,Validator validator){this.service=service;this.accounts=accounts;this.json=json;this.validator=validator;}
    @GetMapping("/tenants/me") @PreAuthorize("hasAuthority('SCOPE_registry:read')")
    public Object tenant(){return service.tenant();}
    @PatchMapping("/tenants/me") @PreAuthorize("hasAuthority('SCOPE_admin:write')")
    public Object tenant(@Valid @RequestBody NameInput input){return service.renameTenant(input);}
    @GetMapping("/organizations") @PreAuthorize("hasAuthority('SCOPE_registry:read')")
    public Object organizations(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.organizations(page,size);}
    @PostMapping("/organizations") @PreAuthorize("hasAuthority('SCOPE_admin:write')")
    public Object organization(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody NameInput input){return service.idempotent("organization",key,input,()->service.createOrganization(input));}
    @GetMapping("/users") @PreAuthorize("hasAuthority('SCOPE_admin:read')")
    public Page<Account> users(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return accounts.list(page,size);}
    @PostMapping("/users") @PreAuthorize("hasAuthority('SCOPE_admin:write')")
    public Object user(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody AccountInput input){return service.idempotent("account",key,input,()->accounts.create(input));}
    @PatchMapping("/users/{id}/role") @PreAuthorize("hasAuthority('SCOPE_admin:write')")
    public Account role(@PathVariable UUID id,@Valid @RequestBody RoleInput input){return accounts.change(id,input);}
    @PostMapping("/cities") @PreAuthorize("hasAuthority('SCOPE_registry:write')")
    public Object city(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody CityInput input){return service.idempotent("city",key,input,()->service.createCity(input));}
    @GetMapping("/cities/{id}/zones") @PreAuthorize("hasAuthority('SCOPE_registry:read')")
    public Object zones(@PathVariable UUID id){return service.zones(id);}
    @PostMapping("/zones") @PreAuthorize("hasAuthority('SCOPE_registry:write')")
    public Object zone(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody ZoneInput input){return service.idempotent("zone",key,input,()->service.createZone(input));}
    @GetMapping("/areas") @PreAuthorize("hasAuthority('SCOPE_registry:read')")
    public Object areas(@RequestParam UUID cityId,@RequestParam(required=false) String kind,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.areas(cityId,kind,page,size);}
    @PostMapping("/areas") @PreAuthorize("hasAuthority('SCOPE_registry:write')")
    public Object area(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody AreaInput input){return service.idempotent("area",key,input,()->service.createArea(input));}
    @GetMapping("/businesses") @PreAuthorize("hasAuthority('SCOPE_registry:read')")
    public Object businesses(@RequestParam(defaultValue="") @Size(max=100) String search,@RequestParam(defaultValue="name") String sort,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.businesses(search,sort,page,size);}
    @PostMapping("/businesses") @PreAuthorize("hasAuthority('SCOPE_registry:write')")
    public Object business(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody BusinessInput input){return service.idempotent("business",key,input,()->service.createBusiness(input));}
    @GetMapping("/sources") @PreAuthorize("hasAuthority('SCOPE_data:read')")
    public Object sources(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.sources(page,size);}
    @PostMapping("/sources") @PreAuthorize("hasAuthority('SCOPE_data:write')")
    public Object source(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody SourceInput input){return service.idempotent("source",key,input,()->service.createSource(input));}
    @PostMapping("/observations") @PreAuthorize("hasAuthority('SCOPE_data:write')")
    public Object observation(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody ObservationInput input){return service.idempotent("observation",key,input,()->service.createObservation(input));}
    @GetMapping("/observations") @PreAuthorize("hasAuthority('SCOPE_data:read')")
    public Object history(@RequestParam UUID cityId,@RequestParam String commodity,@RequestParam String unit,@RequestParam Instant from,@RequestParam Instant to,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.history(cityId,commodity,unit,from,to,page,size);}
    @GetMapping("/inventories") @PreAuthorize("hasAuthority('SCOPE_data:read')")
    public Object inventories(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.inventories(page,size);}
    @PostMapping("/inventories") @PreAuthorize("hasAuthority('SCOPE_data:write')")
    public Object inventory(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody InventoryInput input){return service.idempotent("inventory",key,input,()->service.createInventory(input));}
    @GetMapping("/analytics/imbalance") @PreAuthorize("hasAuthority('SCOPE_analytics:read')")
    public Object imbalance(@RequestParam UUID cityId,@RequestParam String commodity,@RequestParam String unit,@RequestParam Instant from,@RequestParam Instant to){return service.imbalance(cityId,commodity,unit,from,to);}
    @GetMapping("/opportunities") @PreAuthorize("hasAuthority('SCOPE_analytics:read')")
    public Object opportunities(@RequestParam UUID cityId,@RequestParam String commodity,@RequestParam String unit,@RequestParam Instant from,@RequestParam Instant to){return service.opportunities(cityId,commodity,unit,from,to);}
    @PostMapping("/optimizations") @PreAuthorize("hasAuthority('SCOPE_analytics:write')")
    public Object optimize(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody OptimizationInput input){return service.idempotent("optimization",key,input,()->service.optimize(input));}
    @PostMapping("/forecasts") @PreAuthorize("hasAuthority('SCOPE_analytics:write')")
    public Object forecast(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody ForecastInput input){return service.idempotent("forecast",key,input,()->service.forecast(input));}
    @GetMapping("/forecasts") @PreAuthorize("hasAuthority('SCOPE_analytics:read')")
    public Object forecasts(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.forecasts(page,size);}
    @PostMapping("/verifications") @PreAuthorize("hasAuthority('SCOPE_data:write')")
    public Object verification(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody VerificationInput input){return service.idempotent("verification",key,input,()->service.verification(input));}
    @GetMapping("/verifications") @PreAuthorize("hasAuthority('SCOPE_data:read')")
    public Object verifications(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.verifications(page,size);}
    @GetMapping("/notifications") @PreAuthorize("hasAuthority('SCOPE_registry:read')")
    public Object notifications(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.notifications(page,size);}
    @PostMapping("/notifications") @PreAuthorize("hasAuthority('SCOPE_admin:write')")
    public Object notification(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody NotificationInput input){return service.idempotent("notification",key,input,()->service.notify(input));}
    @PatchMapping("/notifications/{id}/read") @PreAuthorize("hasAuthority('SCOPE_registry:read')")
    public Object read(@PathVariable UUID id){return service.readNotification(id);}
    @GetMapping("/admin/audit") @PreAuthorize("hasAuthority('SCOPE_admin:read')")
    public Object audit(@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size){return service.auditLog(page,size);}
    @GetMapping("/admin/configuration") @PreAuthorize("hasAuthority('SCOPE_admin:read')")
    public Object config(){return service.configuration();}
    @PutMapping("/admin/configuration") @PreAuthorize("hasAuthority('SCOPE_admin:write')")
    public Object config(@RequestBody Map<String,Object> input){return service.configure(input);}
    @GetMapping(value="/reports/export",produces="text/csv") @PreAuthorize("hasAuthority('SCOPE_data:read')")
    public ResponseEntity<String> export(@RequestParam UUID cityId,@RequestParam String commodity,@RequestParam String unit,@RequestParam Instant from,@RequestParam Instant to){var rows=service.history(cityId,commodity,unit,from,to,0,100);var csv=new StringBuilder("id,kind,commodity,quantity,unit,observed_at\r\n");for(var row:rows){for(String field:List.of("id","kind","commodity","quantity","unit","observed_at")){String value=String.valueOf(row.get(field));if(value.matches("^[=+@\\-\\t\\r].*"))value="'"+value;csv.append('"').append(value.replace("\"","\"\"")).append("\",");}csv.setLength(csv.length()-1);csv.append("\r\n");}return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=citypulse-observations.csv").header("X-Export-Limit","100").body(csv.toString());}
    @PostMapping(value="/imports/observations",consumes=MediaType.MULTIPART_FORM_DATA_VALUE) @PreAuthorize("hasAuthority('SCOPE_data:write')")
    public Object importObservations(@RequestHeader("Idempotency-Key") String key,@RequestPart("file") MultipartFile file) throws Exception {
        if(file.getSize()>1000000||file.isEmpty()||!MediaType.APPLICATION_JSON_VALUE.equals(file.getContentType()))throw new IllegalArgumentException("Provide a nonempty application/json file up to 1 MB");
        var rows=json.readValue(new String(file.getBytes(),StandardCharsets.UTF_8),ObservationInput[].class);if(rows.length==0||rows.length>500)throw new IllegalArgumentException("Use 1..500 observations per import");for(var row:rows)if(!validator.validate(row).isEmpty())throw new IllegalArgumentException("Import contains invalid observation fields");
        return service.idempotent("import-observations",key,List.of(rows),()->Map.of("created",Arrays.stream(rows).map(service::createObservation).toList(),"count",rows.length));
    }
}
