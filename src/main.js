import './styles.css';
import { SpainTrainApp } from './app.js';

const appRoot = document.getElementById('app');
const app = new SpainTrainApp(appRoot);
app.init();
