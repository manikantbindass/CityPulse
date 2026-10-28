package io.citypulse.shared.api;

import jakarta.validation.ConstraintViolationException;
import java.net.URI;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrors {

    private ProblemDetail problem(int status, String code, String detail) {
        var result = ProblemDetail.forStatusAndDetail(HttpStatus.valueOf(status), detail);
        result.setType(URI.create("urn:citypulse:problem:" + code.toLowerCase().replace('_', '-')));
        result.setTitle(HttpStatus.valueOf(status).getReasonPhrase());
        result.setProperty("code", code);
        return result;
    }

    @ExceptionHandler({
        IllegalArgumentException.class,
        java.time.DateTimeException.class,
        MethodArgumentTypeMismatchException.class,
        MethodArgumentNotValidException.class,
        ConstraintViolationException.class,
        HttpMessageNotReadableException.class,
    })
    public ProblemDetail invalid(Exception error) {
        return problem(
            400,
            "INVALID_REQUEST",
            "Validate required fields, enum values, geometry, time ranges, and pagination bounds."
        );
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail conflict(Exception error) {
        return problem(
            409,
            "DATA_CONFLICT",
            "The operation conflicts with uniqueness, reference, or geometry constraints."
        );
    }

    @ExceptionHandler(DataAccessException.class)
    public ProblemDetail unavailable(Exception error) {
        return problem(503, "STORAGE_UNAVAILABLE", "Storage temporarily unavailable.");
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ProblemDetail status(ResponseStatusException error) {
        return problem(
            error.getStatusCode().value(),
            "REQUEST_REJECTED",
            error.getReason() == null ? "Request rejected" : error.getReason()
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail denied(Exception error) {
        return problem(403, "FORBIDDEN", "Insufficient permission or tenant identity.");
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ProblemDetail large(Exception error) {
        return problem(413, "PAYLOAD_TOO_LARGE", "Import files must be at most 1 MB.");
    }
}
