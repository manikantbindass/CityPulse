package io.citypulse.identity;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.JwtDecoder;

@Configuration
@EnableMethodSecurity
public class SecurityConfiguration {
    private HttpSecurity base(HttpSecurity http) throws Exception {
        return http.csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/api/v1/cities").hasAuthority("SCOPE_registry:read")
                        .anyRequest().authenticated())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, error) -> {
                            response.setStatus(401);
                            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
                            response.getWriter().write("{\"type\":\"urn:citypulse:problem:unauthorized\",\"title\":\"Unauthorized\",\"status\":401,\"code\":\"UNAUTHORIZED\"}");
                        })
                        .accessDeniedHandler((request, response, error) -> {
                            response.setStatus(403);
                            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
                            response.getWriter().write("{\"type\":\"urn:citypulse:problem:forbidden\",\"title\":\"Forbidden\",\"status\":403,\"code\":\"FORBIDDEN\"}");
                        }));
    }

    @Bean
    @Profile("local")
    SecurityFilterChain local(HttpSecurity http, @Value("${citypulse.local-token}") String token,
                               StringRedisTemplate redis,TenantContext tenant, io.citypulse.workspace.infrastructure.AccountRepository accounts) throws Exception {
        return base(http).addFilterBefore(new LocalTokenFilter(token), UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(new MembershipFilter(accounts,tenant),AuthorizationFilter.class)
                .addFilterAfter(new ApiRateLimitFilter(redis,tenant),MembershipFilter.class).build();
    }

    @Bean
    @Profile("!local")
    SecurityFilterChain oidc(HttpSecurity http,StringRedisTemplate redis,TenantContext tenant, io.citypulse.workspace.infrastructure.AccountRepository accounts) throws Exception {
        return base(http).oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()))
                .addFilterAfter(new MembershipFilter(accounts,tenant),AuthorizationFilter.class)
                .addFilterAfter(new ApiRateLimitFilter(redis,tenant),MembershipFilter.class).build();
    }

    @Bean @Profile("!local")
    JwtDecoder decoder(@Value("${OIDC_ISSUER_URI}") String issuer,@Value("${OIDC_AUDIENCE}") String audience){
        NimbusJwtDecoder decoder=JwtDecoders.fromIssuerLocation(issuer);
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer),new JwtClaimValidator<java.util.List<String>>("aud",aud->aud!=null&&aud.contains(audience))));return decoder;
    }
}
