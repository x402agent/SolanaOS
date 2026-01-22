import { StyleSheet } from "react-native";
import COLORS from "../../../../assets/colors";

export const styles = StyleSheet.create({
    container: {flex: 1, alignItems: 'center', backgroundColor: '#FFFFFF', paddingTop: 50},
    headerList: {fontSize: 20, paddingTop: 20},
    list: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        width: '100%',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.greyBorderdark
    },
    menuItem: {
        fontWeight: 'bold',
        fontSize: 16,
        paddingVertical: 10,
        position: 'relative'
    },
    menuItemSelected: {
        borderBottomWidth: 2,
        borderBottomColor: COLORS.cyan
    },
    MainSection: {
        flex: 1,
        width: '100%',
    alignItems: 'center'
    }
  });