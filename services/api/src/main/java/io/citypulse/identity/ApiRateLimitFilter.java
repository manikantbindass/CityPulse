package io.citypulse.identity;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.web.filter.OncePerRequestFilter;
import io.citypulse.workspace.application.WorkspaceService;

final class ApiRateLimitFilter extends OncePerRequestFilter {
    private final StringRedisTemplate redis;private final TenantContext context;
    private final DefaultRedisScript<Long> counter=new DefaultRedisScript<>("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",Long.class);
    ApiRateLimitFilter(StringRedisTemplate redis,TenantContext context){this.redis=redis;this.context=context;}
    @Override protected boolean shouldNotFilter(HttpServletRequest request){return !request.getRequestURI().startsWith("/api/");}
    @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain) throws ServletException,IOException {
        if(request.getContentLengthLong()>1100000){reject(response,413,"PAYLOAD_TOO_LARGE");return;}
        try {
            String key="rate:"+context.tenantId()+":"+WorkspaceService.digest(context.subject());
            Long count=redis.execute(counter,List.of(key));
            if(count==null){reject(response,503,"RATE_LIMIT_UNAVAILABLE");return;}
            response.setHeader("X-RateLimit-Limit","180");response.setHeader("X-RateLimit-Remaining",String.valueOf(Math.max(0,180-count)));
            if(count>180){response.setHeader("Retry-After","60");reject(response,429,"RATE_LIMIT_EXCEEDED");return;}
        }catch(org.springframework.security.access.AccessDeniedException error){reject(response,403,"TENANT_REQUIRED");return;}
        catch(org.springframework.dao.DataAccessException error){reject(response,503,"RATE_LIMIT_UNAVAILABLE");return;}
        chain.doFilter(request,response);
    }
    private void reject(HttpServletResponse response,int status,String code) throws IOException {
        response.setStatus(status);response.setContentType("application/problem+json");response.getWriter().write("{\"type\":\"urn:citypulse:problem:request\",\"title\":\"Request rejected\",\"status\":"+status+",\"code\":\""+code+"\"}");
    }
}
