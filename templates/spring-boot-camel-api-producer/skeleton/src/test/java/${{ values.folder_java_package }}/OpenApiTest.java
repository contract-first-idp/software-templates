package ${{ values.java_package }};

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

    @LocalServerPort
    private int port;

    @Test
    public void testFullIntegration() {
        String getResponse = this.restTemplate
                .getForObject("http://localhost:" + port + "/api-doc", String.class);

        Assertions.assertThat(getResponse).isNotNull();
    }

}
