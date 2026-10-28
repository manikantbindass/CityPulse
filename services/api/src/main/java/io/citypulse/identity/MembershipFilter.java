package io.citypulse.identity;

import io.citypulse.workspace.infrastructure.AccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/** Database membership can only narrow signed IdP scopes, never grant new scopes. */
final class MembershipFilter extends OncePerRequestFilter {
    private final AccountRepository accounts;private final TenantContext tenant;
    MembershipFilter(AccountRepository accounts,TenantContext tenant){this.accounts=accounts;this.tenant=tenant;}
    @Override protected boolean shouldNotFilter(HttpServletRequest request){return !request.getRequestURI().startsWith("/api/");}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws IOException,ServletException {
        try {
            var account=accounts.findByTenantIdAndSubject(tenant.tenantId(),tenant.subject());
            if(account.isEmpty()||!account.get().enabled){reject(response,403,"MEMBERSHIP_REQUIRED");return;}
            Set<String> allowed=switch(account.get().role){
                case ADMIN->Set.of("registry:read","registry:write","data:read","data:write","analytics:read","analytics:write","admin:read","admin:write");
                case ANALYST,PLANNER->Set.of("registry:read","data:read","analytics:read","analytics:write");
                case PROVIDER,BUSINESS_OWNER->Set.of("registry:read","data:read","data:write","analytics:read");
                case CITIZEN->Set.of("registry:read");
            };
            var auth=SecurityContextHolder.getContext().getAuthentication();
            var narrowed=auth.getAuthorities().stream().filter(a->allowed.contains(a.getAuthority().replaceFirst("^SCOPE_",""))).toList();
            if(auth instanceof JwtAuthenticationToken jwt)SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt.getToken(),narrowed,auth.getName()));
            else SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(auth.getPrincipal(),null,narrowed));
        }catch(org.springframework.security.access.AccessDeniedException e){reject(response,403,"TENANT_REQUIRED");return;}
        catch(org.springframework.dao.DataAccessException e){reject(response,503,"MEMBERSHIP_UNAVAILABLE");return;}
        chain.doFilter(request,response);
    }
    private void reject(HttpServletResponse response,int status,String code) throws IOException {response.setStatus(status);response.setContentType("application/problem+json");response.getWriter().write("{\"type\":\"urn:citypulse:problem:membership\",\"title\":\"Access rejected\",\"status\":"+status+",\"code\":\""+code+"\"}");}
}
