"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function createChildLogger(logger, className) {
    return logger.child({ child: "rokot-mq-rabbit", class: className }, true);
}
exports.createChildLogger = createChildLogger;
