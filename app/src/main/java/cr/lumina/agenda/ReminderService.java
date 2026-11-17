package cr.lumina.agenda;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import org.json.*;
import java.time.*;
import java.time.format.DateTimeFormatter;

public final class ReminderService {
    private static final String PREF="lumina_reminders", CHANNEL="appointments";
    static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences(PREF,Context.MODE_PRIVATE);}
    public static void channel(Context c){
        NotificationChannel ch=new NotificationChannel(CHANNEL,"Recordatorios de citas",NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Avisos de las citas de LÚMINA");ch.enableVibration(true);
        c.getSystemService(NotificationManager.class).createNotificationChannel(ch);
    }
    public static boolean allowed(Context c){
        channel(c);
        NotificationManager nm=c.getSystemService(NotificationManager.class);
        return (Build.VERSION.SDK_INT<33||c.checkSelfPermission("android.permission.POST_NOTIFICATIONS")==PackageManager.PERMISSION_GRANTED)
            &&nm.areNotificationsEnabled()&&nm.getNotificationChannel(CHANNEL).getImportance()!=NotificationManager.IMPORTANCE_NONE;
    }
    public static boolean exact(Context c){return Build.VERSION.SDK_INT<31||c.getSystemService(AlarmManager.class).canScheduleExactAlarms();}
    private static JSONArray array(String s){try{return new JSONArray(s);}catch(Exception e){return new JSONArray();}}
    public static synchronized void sync(Context c,String json,boolean enabled) {
        JSONArray source=array(json);
        if(source.length()>10000)throw new IllegalArgumentException("Demasiadas citas");
        String previous=prefs(c).getString("source","[]");
        boolean same=previous.equals(source.toString())&&prefs(c).getBoolean("enabled",false)==enabled;
        prefs(c).edit().putString("source",source.toString()).putBoolean("enabled",enabled).apply();
        if(!same)rebuild(c);
    }
    public static synchronized void rebuild(Context c){
        JSONArray old=array(prefs(c).getString("pending","[]")),next=new JSONArray();
        long now=System.currentTimeMillis();
        if(prefs(c).getBoolean("enabled",false)){
            JSONArray source=array(prefs(c).getString("source","[]"));
            for(int n=0;n<source.length();n++){
                try{
                    JSONObject a=source.getJSONObject(n);
                    if(a.optBoolean("cancelled")||"Realizada".equals(a.optString("status"))||"Ausente".equals(a.optString("status")))continue;
                    long start=LocalDateTime.parse(a.getString("date")+"T"+a.getString("time")).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
                    for(long lead:ReminderPlan.futureLeads(start,now)){
                        String key=a.getString("id")+"_"+start+"_"+lead;
                        String when=lead==172800000L?"Dentro de dos días tienes una cita":lead==86400000L?"Mañana tienes una cita":lead==3600000L?"Tu cita comienza en una hora":"Es la hora de tu cita";
                        next.put(new JSONObject().put("key",key).put("at",start-lead).put("body",when+" · "+a.getString("date")+" "+a.getString("time")));
                    }
                }catch(Exception ignored){}
            }
        }
        prefs(c).edit().putString("pending",next.toString()).commit();
        AlarmManager manager=c.getSystemService(AlarmManager.class);
        for(int n=0;n<old.length();n++){JSONObject item=old.optJSONObject(n);if(item!=null)manager.cancel(intent(c,item.optString("key")));}
        for(int n=0;n<next.length();n++){JSONObject item=next.optJSONObject(n);if(item!=null)schedule(c,item.optString("key"),item.optLong("at"));}
    }
    private static PendingIntent intent(Context c,String key){
        Intent i=new Intent(c,ReminderReceiver.class).setAction("cr.lumina.REMINDER").setData(Uri.parse("lumina://reminder/"+Uri.encode(key))).putExtra("key",key);
        return PendingIntent.getBroadcast(c,0,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    private static void schedule(Context c,String key,long at){
        AlarmManager am=c.getSystemService(AlarmManager.class);
        try{if(exact(c))am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,intent(c,key));else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,intent(c,key));}
        catch(SecurityException e){am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,intent(c,key));}
    }
    public static synchronized void deliver(Context c,String key){
        JSONArray pending=array(prefs(c).getString("pending","[]")),remaining=new JSONArray();JSONObject selected=null;
        for(int n=0;n<pending.length();n++){JSONObject item=pending.optJSONObject(n);if(item==null)continue;if(key.equals(item.optString("key")))selected=item;else remaining.put(item);}
        if(selected==null)return;
        prefs(c).edit().putString("pending",remaining.toString()).commit();
        if(prefs(c).getBoolean("enabled",false))notifyNow(c,key,selected.optString("body"));
    }
    public static void notifyNow(Context c,String key,String body){
        if(!allowed(c))return;
        PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification n=new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle("LÚMINA · Recordatorio")
            .setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setContentIntent(open).setAutoCancel(true)
            .setVisibility(Notification.VISIBILITY_PRIVATE).build();
        try{c.getSystemService(NotificationManager.class).notify(key.hashCode(),n);}catch(SecurityException ignored){}
    }
    public static synchronized void test(Context c){
        if(!allowed(c))return;
        prefs(c).edit().putBoolean("enabled",true).apply();
        JSONArray pending=array(prefs(c).getString("pending","[]"));String key="test_"+System.currentTimeMillis();long at=System.currentTimeMillis()+120000;
        try{pending.put(new JSONObject().put("key",key).put("at",at).put("body","Prueba correcta: LÚMINA puede avisarte con la aplicación cerrada."));}catch(JSONException ignored){}
        prefs(c).edit().putString("pending",pending.toString()).commit();schedule(c,key,at);
        notifyNow(c,"test_now","Avisos activados. La prueba de fondo está programada para dentro de dos minutos.");
    }
    public static String status(Context c){
        JSONObject s=new JSONObject();int count=0;long next=Long.MAX_VALUE,now=System.currentTimeMillis();
        JSONArray pending=array(prefs(c).getString("pending","[]"));
        for(int n=0;n<pending.length();n++){JSONObject p=pending.optJSONObject(n);if(p!=null&&p.optLong("at")>now){count++;next=Math.min(next,p.optLong("at"));}}
        try{s.put("allowed",allowed(c)).put("enabled",prefs(c).getBoolean("enabled",false)).put("exact",exact(c)).put("count",count).put("next",next==Long.MAX_VALUE?0:next);}catch(JSONException ignored){}
        return s.toString();
    }
}
