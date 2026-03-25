function runTestCase(container) {
	const chart = window.chart = LightweightCharts.createChart(container, { layout: { attributionLogo: false } });

	const mainSeries = chart.addSeries(LightweightCharts.CandlestickSeries);
	mainSeries.setData([
		{ time: '2024-01-01', open: 100, high: 105, low: 95, close: 102 },
		{ time: '2024-01-02', open: 102, high: 110, low: 100, close: 108 },
		{ time: '2024-01-03', open: 108, high: 115, low: 105, close: 112 },
	]);

	const oscillatorSeries = chart.addSeries(LightweightCharts.LineSeries, {
		color: '#00C853',
		lineWidth: 2,
	}, 1);

	oscillatorSeries.setData([
		{ time: '2024-01-01', value: -344 },
		{ time: '2024-01-02', value: -868 },
		{ time: '2024-01-03', value: 495 },
	]);

	return new Promise((resolve, reject) => {
		requestAnimationFrame(() => {
			try {
				console.assert(chart.panes().length === 2, 'Should have 2 panes before removal');

				chart.removeSeries(oscillatorSeries);

				requestAnimationFrame(() => {
					try {
						console.assert(chart.panes().length === 1, 'Pane should be removed after removing series with large values');
						resolve();
					} catch (error) {
						reject(error);
					}
				});
			} catch (error) {
				reject(error);
			}
		});
	});
}
