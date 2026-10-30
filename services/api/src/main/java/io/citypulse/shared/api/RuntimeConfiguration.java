package io.citypulse.shared.api;

import com.fasterxml.jackson.core.StreamReadConstraints;
import java.time.Duration;
import org.springframework.boot.jackson2.autoconfigure.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;

@Configuration
@EnableCaching
public class RuntimeConfiguration {

    /** Preserve the public Jackson-2 DTO/tree contract during the security upgrade. */
    @Bean
    org.springframework.web.servlet.config.annotation.WebMvcConfigurer jsonContract(
        com.fasterxml.jackson.databind.ObjectMapper mapper
    ) {
        return new org.springframework.web.servlet.config.annotation.WebMvcConfigurer() {
            @Override
            public void extendMessageConverters(
                java.util.List<
                    org.springframework.http.converter.HttpMessageConverter<?>
                > converters
            ) {
                int position = 0;
                for (int i = 0; i < converters.size(); i++) {
                    if (
                        converters.get(i) instanceof
                            org.springframework.http.converter.ByteArrayHttpMessageConverter ||
                        converters.get(i) instanceof
                            org.springframework.http.converter.StringHttpMessageConverter
                    ) position = i + 1;
                }
                converters.add(
                    position,
                    new org.springframework.http.converter.json.MappingJackson2HttpMessageConverter(
                        mapper
                    )
                );
            }
        };
    }

    @Bean
    RedisCacheConfiguration cacheDefaults() {
        return RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofSeconds(30))
            .disableCachingNullValues();
    }

    @Bean
    Jackson2ObjectMapperBuilderCustomizer jsonLimits() {
        return builder ->
            builder.postConfigurer(mapper ->
                mapper
                    .enable(
                        com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES
                    )
                    .getFactory()
                    .setStreamReadConstraints(
                        StreamReadConstraints.builder()
                            .maxStringLength(200000)
                            .maxNestingDepth(30)
                            .maxNumberLength(100)
                            .build()
                    )
            );
    }
}
