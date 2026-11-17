package cr.lumina.agenda;
import android.content.*;
public class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c,Intent i) {
        if("cr.lumina.REMINDER".equals(i.getAction()))ReminderService.deliver(c,i.getStringExtra("key"));
        else ReminderService.rebuild(c);
    }
}
