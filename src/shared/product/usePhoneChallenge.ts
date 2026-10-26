import { onBeforeUnmount, ref, watch } from 'vue';
import type { MockActionSpec } from '../../contracts/mock';
import { useRequest } from './useRequest';
export function usePhoneChallenge(spec: MockActionSpec) {
  const request = useRequest(spec);
  request.values.phone = '';
  const code = ref('');
  const sent = ref(false);
  const seconds = ref(0);
  const note = ref('');
  let timer: ReturnType<typeof setInterval> | undefined;
  watch(
    () => request.values.phone,
    () => {
      sent.value = false;
      code.value = '';
      note.value = '';
      seconds.value = 0;
      if (timer) clearInterval(timer);
    },
  );
  async function send(): Promise<void> {
    if (seconds.value || request.pending.value) return;
    if (await request.submit()) {
      sent.value = true;
      note.value = '验证码已发送，演示验证码为 123456。';
      seconds.value = 30;
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (seconds.value > 0) seconds.value--;
        else if (timer) clearInterval(timer);
      }, 1000);
    }
  }
  function verify(): boolean {
    request.error.value = '';
    if (!sent.value) {
      request.error.value = '请先获取短信验证码。';
      return false;
    }
    if (code.value !== '123456') {
      request.error.value = '验证码不正确，请输入 123456。';
      return false;
    }
    return true;
  }
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
  });
  return { ...request, code, sent, seconds, note, send, verify };
}
