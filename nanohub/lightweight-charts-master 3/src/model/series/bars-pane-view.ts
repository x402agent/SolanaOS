import {
	BarItem,
	PaneRendererBars,
} from "../../renderers/bars-renderer";
import { SeriesBarColorer } from "../series-bar-colorer";
import { SeriesPlotRow } from "../series-data";
import { SeriesType } from "../series-options";
import { TimePointIndex } from "../time-data";
import { BarsPaneViewBase } from "./bars-pane-view-base";

export class SeriesBarsPaneView extends BarsPaneViewBase<'Bar', BarItem, PaneRendererBars> {
	protected readonly _renderer: PaneRendererBars = new PaneRendererBars();

	protected _createRawItem(time: TimePointIndex, bar: SeriesPlotRow<SeriesType>, colorer: SeriesBarColorer<'Bar'>): BarItem {
		return {
			...this._createDefaultItem(time, bar, colorer),
			...colorer.barStyle(time),
		};
	}

	protected _prepareRendererData(): void {
		const barStyleProps = this._series.options();

		this._renderer.setData({
			bars: this._items,
			barSpacing: this._model.timeScale().barSpacing(),
			openVisible: barStyleProps.openVisible,
			thinBars: barStyleProps.thinBars,
			visibleRange: this._itemsVisibleRange,
		});
	}
}
