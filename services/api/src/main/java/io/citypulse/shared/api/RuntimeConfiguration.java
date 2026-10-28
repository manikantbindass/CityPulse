package io.citypulse.shared.api;

import com.fasterxml.jackson.core.StreamReadConstraints;
import java.time.Duration;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;

@Configuration
@EnableCaching
public class RuntimeConfiguration {

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
