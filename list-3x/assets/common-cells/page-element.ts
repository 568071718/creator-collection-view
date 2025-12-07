import { _decorator, Component, Label, Node } from 'cc';
import { YXCollectionView } from '../lib/yx-collection-view';
import { YXTableLayout } from '../lib/yx-table-layout';
const { ccclass, property } = _decorator;

@ccclass('PageElement')
export class PageElement extends Component {
    @property(Label)
    titleLabel: Label = null

    @property(YXCollectionView)
    listComp: YXCollectionView = null

    protected start(): void {
        this.listComp.numberOfItems = () => {
            return 10000
        }
        this.listComp.cellForItemAt = (indexPath, collectionView) => {
            const cell = collectionView.dequeueReusableCell(`cell`)
            cell.getChildByName('label').getComponent(Label).string = `${indexPath}`
            return cell
        }

        let layout = new YXTableLayout()
        layout.spacing = 10
        layout.rowHeight = 100
        this.listComp.layout = layout

        this.listComp.reloadData()
    }
}


