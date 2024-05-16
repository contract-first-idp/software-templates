package com.redhat.employee;

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
                .to("log:com.mycompany.order?showAll=true&multiline=true");

    }
}
