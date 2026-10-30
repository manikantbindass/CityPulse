package io.citypulse.shared.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;

class RuntimeConfigurationTest {

    @RestController
    static class Contract {

        @GetMapping(value = "/contract", produces = "application/json")
        byte[] contract() {
            return "{\"openapi\":\"3.0.3\"}".getBytes(StandardCharsets.UTF_8);
        }

        @GetMapping(value = "/tree", produces = "application/json")
        com.fasterxml.jackson.databind.JsonNode tree() {
            return new ObjectMapper().createObjectNode().put("value", 7);
        }
    }

    @Test
    void rawJsonBytesAndJackson2TreesKeepTheirWireContracts() throws Exception {
        var converters = new ArrayList<HttpMessageConverter<?>>();
        converters.add(new ByteArrayHttpMessageConverter());
        converters.add(new StringHttpMessageConverter());
        new RuntimeConfiguration()
            .jsonContract(new ObjectMapper())
            .extendMessageConverters(converters);
        var mvc = MockMvcBuilders.standaloneSetup(new Contract())
            .setMessageConverters(converters.toArray(HttpMessageConverter[]::new))
            .build();
        mvc.perform(get("/contract"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.openapi").value("3.0.3"));
        mvc.perform(get("/tree"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.value").value(7));
    }
}
