import './styles.css';
import { SpainTrainApp } from './app.js';
import { logger } from './core/logger.js';

const appRoot = document.getElementById('app');
const app = new SpainTrainApp(appRoot);
app.init().catch((error) => {
	logger.error('App startup failed', { message: String(error?.message || error) });
	appRoot.innerHTML = `
		<div style="padding:16px;font-family:'Space Grotesk','Segoe UI',Tahoma,sans-serif;">
			<h2>SpainTrain failed to start</h2>
			<p>Please refresh the page. If the problem persists, clear site data.</p>
		</div>
	`;
});
