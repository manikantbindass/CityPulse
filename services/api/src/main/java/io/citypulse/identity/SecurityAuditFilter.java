package io.citypulse.identity;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Deliberately excludes URL parameters, bodies, cookies, tokens, IPs and PII. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SecurityAuditFilter extends OncePerRequestFilter {

    private static final Logger LOG = LoggerFactory.getLogger(SecurityAuditFilter.class);

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws IOException, ServletException {
        String id = UUID.randomUUID().toString();
        response.setHeader("X-Request-ID", id);
        long start = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            if (request.getRequestURI().startsWith("/api/")) LOG.info(
                "security_request request_id={} method={} status={} duration_ms={}",
                id,
                request.getMethod().replaceAll("[^A-Z]", ""),
                response.getStatus(),
                (System.nanoTime() - start) / 1000000
            );
        }
    }
}
