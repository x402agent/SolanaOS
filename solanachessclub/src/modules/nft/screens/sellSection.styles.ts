import { StyleSheet } from 'react-native';

export const sellStyles = StyleSheet.create({
  sellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  infoText: { 
    fontSize: 14, 
    fontWeight: '500' 
  },
  reloadButton: {
    backgroundColor: '#f3f3f3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6
  },
  reloadButtonText: { 
    fontWeight: '600' 
  },
  listedCard: {
    width: 140,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    margin: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  imageContainer: {
    width: '100%',
    height: 140,
    backgroundColor: '#f7f7f7'
  },
  nftImage: { 
    width: '100%', 
    height: '100%' 
  },
  placeholderImage: {
    flex: 1,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center'
  },
  placeholderText: { 
    color: '#999' 
  },
  nftDetails: { 
    padding: 8 
  },
  nftName: {
    fontWeight: '600',
    fontSize: 14,
    color: '#222',
    marginBottom: 4
  },
  collectionName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4
  },
  mintAddress: {
    fontSize: 10,
    color: '#999'
  },
  priceText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '500',
    color: '#333'
  },
  errorText: {
    color: '#ff6b6b',
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#fff0f0',
    borderRadius: 4,
    fontSize: 12
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  loadingText: {
    marginTop: 12,
    color: '#666'
  },
  nftList: {
    paddingBottom: 80
  },
  nftGrid: {
    justifyContent: 'space-between',
    marginBottom: 12
  },
  nftCard: {
    width: '48%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  nftCardSelected: {
    borderColor: '#32D4DE',
    borderWidth: 2,
    backgroundColor: '#f0fbfc'
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#32D4DE',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center'
  },
  selectedText: {
    color: 'white',
    fontWeight: 'bold'
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center'
  },
  emptyListText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  sellForm: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    width: '90%',
    borderWidth: 1,
    borderColor: '#eee'
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333'
  },
  selectedNftInfo: {
    marginBottom: 16,
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 8
  },
  label: {
    fontWeight: '600',
    marginVertical: 4,
    color: '#444'
  },
  selectedNftName: {
    fontWeight: '500',
    marginBottom: 4,
    color: '#222'
  },
  selectedMint: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: '#dadada',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    backgroundColor: '#fafafa'
  },
  actionButton: {
    backgroundColor: '#32D4DE',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  nftSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2a2a2a',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
});
