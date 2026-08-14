package ${{ values.java_package }};

import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import org.apache.camel.CamelContext;
import org.junit.jupiter.api.Test;

@QuarkusTest
class RuntimeTest {

    @Inject
    CamelContext camelContext;

    @Test
    void camelContextStarts() {
        assertTrue(camelContext.isStarted());
    }
}
