"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const arduino_1 = __importDefault(require("./routes/arduino"));
const circuit_1 = __importDefault(require("./routes/circuit"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/arduino', arduino_1.default);
app.use('/api/circuit', circuit_1.default);
// Routes will be added here
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});
exports.default = app;
