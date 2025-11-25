// src/utils/logger.js
const winston = require('winston');
const path = require('path');

// Configure the log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}]: ${info.message}`)
);

const logger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        // Log to console (so you can see it while coding)
        new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), logFormat)
        }),
        // Log to file (Required for "system logging")
        new winston.transports.File({ 
            filename: path.join(__dirname, '../../logs/system.log'),
            level: 'info' 
        })
    ]
});

module.exports = logger;