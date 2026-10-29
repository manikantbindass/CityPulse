package io.citypulse.shared.api;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.*;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class BodyLimitFilter extends OncePerRequestFilter {

    private static final int MAX = 1100000;

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws IOException, ServletException {
        if (request.getContentLengthLong() > MAX) {
            reject(response);
            return;
        }
        var wrapper = new HttpServletRequestWrapper(request) {
            private int count = 0;

            @Override
            public ServletInputStream getInputStream() throws IOException {
                var input = super.getInputStream();
                return new ServletInputStream() {
                    public int read() throws IOException {
                        int value = input.read();
                        if (value != -1 && ++count > MAX) throw new LimitExceeded();
                        return value;
                    }

                    public int read(byte[] bytes, int offset, int length) throws IOException {
                        int n = input.read(bytes, offset, Math.min(length, 8192));
                        if (n > 0 && (count += n) > MAX) throw new LimitExceeded();
                        return n;
                    }

                    public boolean isFinished() {
                        return input.isFinished();
                    }

                    public boolean isReady() {
                        return input.isReady();
                    }

                    public void setReadListener(ReadListener listener) {
                        input.setReadListener(listener);
                    }
                };
            }

            @Override
            public BufferedReader getReader() throws IOException {
                return new BufferedReader(
                    new InputStreamReader(getInputStream(), java.nio.charset.StandardCharsets.UTF_8)
                );
            }
        };
        try {
            chain.doFilter(wrapper, response);
        } catch (LimitExceeded error) {
            if (!response.isCommitted()) reject(response);
        }
    }

    static class LimitExceeded extends IOException {}

    private void reject(HttpServletResponse response) throws IOException {
        response.setStatus(413);
        response.setContentType("application/problem+json");
        response
            .getWriter()
            .write(
                "{\"title\":\"Payload too large\",\"status\":413,\"code\":\"PAYLOAD_TOO_LARGE\"}"
            );
    }
}
