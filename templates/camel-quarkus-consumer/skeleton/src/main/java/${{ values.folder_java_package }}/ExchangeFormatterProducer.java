package ${{ values.java_package }};

import jakarta.enterprise.inject.Produces;
import org.apache.camel.Exchange;
import org.apache.camel.component.log.LogComponent;
import org.apache.camel.spi.ExchangeFormatter;

public class ExchangeFormatterProducer {

    /**
     * Enum of ANSI escape codes for console colors.
     */
    enum LogColor {
        BLUE("\u001b[34m"),
        YELLOW("\u001b[33m");

        private String escapeCode;

        LogColor(String escapeCode) {
            this.escapeCode = escapeCode;
        }

        public String apply(String string) {
            return this.escapeCode + string + "\u001b[0m";
        }
    }

    /**
     * Custom {@link ExchangeFormatter} bean to apply different colors to messages depending on which log endpoint they are
     * sent to.
     *
     * This bean is automatically wired into the {@link LogComponent} on startup.
     */
    @Produces
    public ExchangeFormatter exchangeFormatter() {
        return new ExchangeFormatter() {
            @Override
            public String format(Exchange exchange) {
                String toEndpoint = exchange.getProperty(Exchange.TO_ENDPOINT, String.class);
                String body = exchange.getMessage().getBody(String.class);
                switch (toEndpoint) {
                case "log://timer":
                    return LogColor.BLUE.apply("Java DSL: " + body);
                case "log://timer-yaml":
                    return LogColor.YELLOW.apply("YAML DSL: " + body);
                default:
                    return body;
                }
            }
        };
    }
}