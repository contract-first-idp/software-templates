package ${{ values.java_package_domain }}.${{ values.java_group_name }}.${{ values.java_package_name }};

import org.apache.camel.opentelemetry.starter.CamelOpenTelemetry;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@CamelOpenTelemetry
@SpringBootApplication
public class MyCamelSpringBootApplication {

    /**
     * A main method to start this application.
     */
    public static void main(String[] args) {
        SpringApplication.run(MyCamelSpringBootApplication.class, args);
    }

}
