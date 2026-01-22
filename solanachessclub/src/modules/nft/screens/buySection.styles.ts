import { StyleSheet } from 'react-native';

export const buyStyles = StyleSheet.create({
  label: {
    fontWeight: '600',
    marginVertical: 4,
    color: '#444'
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
  collectionCard: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 12,
    backgroundColor: '#fff',
    overflow: 'hidden'
  },
  imageContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#f5f5f5'
  },
  collectionImage: {
    width: '100%',
    height: '100%'
  },
  placeholderImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  placeholderText: {
    color: '#999'
  },
  cardContent: {
    flex: 1,
    padding: 8
  },
  collectionName: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 4,
    color: '#222'
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6
  },
  buyButton: {
    marginTop: 8,
    backgroundColor: '#32D4DE',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center'
  },
  buyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  emptyContainer: {
    marginTop: 20,
    alignItems: 'center'
  },
  emptyText: {
    color: '#888'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#eee'
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333'
  },
  modalText: {
    fontSize: 14,
    marginBottom: 8,
    color: '#444'
  },
  confirmButton: {
    marginTop: 16,
    backgroundColor: '#32D4DE',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15
  }
});
