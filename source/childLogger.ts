import * as bunyan from "bunyan";

export function createChildLogger(logger: bunyan, className: string): bunyan {
  return logger.child({ child: "amqp-wrapper", class: className }, true);
}
