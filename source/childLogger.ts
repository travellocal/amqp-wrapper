import * as bunyan from "bunyan";

export function createChildLogger(logger: bunyan, className: string) {
  return logger.child({ child: "rokot-mq-rabbit", class: className }, true);
}
