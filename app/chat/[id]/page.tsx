import ChatApp from "../../components/ChatApp";

export default function ChatPage({ params }: { params: { id: string } }) {
  return <ChatApp chatId={params.id} />;
}
