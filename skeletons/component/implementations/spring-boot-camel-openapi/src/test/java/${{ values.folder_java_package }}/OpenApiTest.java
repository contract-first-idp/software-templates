package ${{ values.java_package }};

import org.apache.camel.CamelContext;
import org.apache.camel.opentelemetry2.OpenTelemetryTracer;
import org.apache.camel.test.spring.junit5.CamelSpringBootTest;
import org.assertj.core.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;

@CamelSpringBootTest
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
public class OpenApiTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private CamelContext camelContext;

    @Autowired
    private OpenTelemetryTracer openTelemetryTracer;

    @LocalServerPort
    private int port;

    @Test
    public void testFullIntegration() {
        Assertions.assertThat(this.camelContext.isStarted()).isTrue();
        Assertions.assertThat(this.openTelemetryTracer).isNotNull();

        String getResponse = this.restTemplate
                .getForObject("http://localhost:" + port + "/api-doc", String.class);

        Assertions.assertThat(getResponse).isNotNull();
    }

}
