package ${{ values.java_package }};

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

@ApplicationScoped
public class TimerRoute extends RouteBuilder {

    @Override
    public void configure() throws Exception {
        from("timer:foo?period={{timer.period}}")
                .bean("greeting", "greet")
                .to("log:timer");
    }
}