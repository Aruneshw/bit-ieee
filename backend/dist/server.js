"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from the parent directory's .env.local if present
dotenv_1.default.config({ path: '../.env.local' });
dotenv_1.default.config();
const PORT = process.env.PORT || 8000;
app_1.default.listen(PORT, () => {
    console.log(`Backend Server running on port ${PORT}`);
});
