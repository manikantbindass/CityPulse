package io.citypulse.registry;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import io.citypulse.identity.SecurityConfiguration;
import io.citypulse.registry.api.CityController;
import io.citypulse.registry.application.CityService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = CityController.class,
    properties = "citypulse.local-token=test-token-for-citypulse-with-32-characters"
)
@ActiveProfiles("local")
@Import({ SecurityConfiguration.class, io.citypulse.identity.TenantContext.class })
class CityControllerTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    CityService service;

    @MockitoBean
    org.springframework.data.redis.core.StringRedisTemplate redis;

    @MockitoBean
    io.citypulse.workspace.infrastructure.AccountRepository accounts;

    @org.junit.jupiter.api.BeforeEach
    void rateLimit() {
        org.mockito.Mockito.when(
            accounts.findByTenantIdAndSubject(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()
            )
        ).thenReturn(
            java.util.Optional.of(
                new io.citypulse.workspace.domain.Account(
                    io.citypulse.identity.TenantContext.LOCAL_TENANT,
                    "local-developer",
                    "Local",
                    io.citypulse.workspace.domain.Account.Role.ADMIN
                )
            )
        );
        org.mockito.Mockito.when(
            redis.execute(
                org.mockito.ArgumentMatchers.any(
                    org.springframework.data.redis.core.script.RedisScript.class
                ),
                org.mockito.ArgumentMatchers.anyList()
            )
        ).thenReturn(1L);
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get("/api/v1/cities"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void returnsTypedPageForValidToken() throws Exception {
        when(service.list(0, 20)).thenReturn(List.of());
        mvc.perform(
            get("/api/v1/cities").header(
                "Authorization",
                "Bearer test-token-for-citypulse-with-32-characters"
            )
        )
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items").isArray())
            .andExpect(jsonPath("$.size").value(20));
    }
}
