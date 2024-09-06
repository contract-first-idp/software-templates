package ${{ values.java_package_name }};

import org.apache.camel.CamelContext;
import org.apache.camel.builder.RouteBuilder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class TimerToLog extends RouteBuilder {

    public TimerToLog(@Autowired CamelContext context) {
        super(context);
    }

    @Override
    public void configure() throws Exception {

        from("timer://foo?fixedRate=true&period=1000")
                .to("log:${{ values.java_package_name }}?showAll=true&multiline=true");

    }
}
