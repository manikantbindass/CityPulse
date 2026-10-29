package io.citypulse.identity;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

final class LocalTokenFilter extends OncePerRequestFilter {

    private final byte[] expected;

    LocalTokenFilter(String token) {
        if (token.length() < 32 || token.startsWith("replace-")) {
            throw new IllegalArgumentException(
                "LOCAL_API_TOKEN must be a random value of at least 32 characters"
            );
        }
        expected = ("Bearer " + token).getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {
        String supplied = request.getHeader("Authorization");
        if (
            supplied != null &&
            MessageDigest.isEqual(expected, supplied.getBytes(StandardCharsets.UTF_8))
        ) {
            var auth = new UsernamePasswordAuthenticationToken(
                "local-developer",
                null,
                List.of(
                    "registry:read",
                    "registry:write",
                    "data:read",
                    "data:write",
                    "analytics:read",
                    "analytics:write",
                    "admin:read",
                    "admin:write"
                )
                    .stream()
                    .map(scope -> new SimpleGrantedAuthority("SCOPE_" + scope))
                    .toList()
            );
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(request, response);
    }
}
