const { Client, GatewayIntentBits, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ChannelType, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent 
    ]
});

const ticketInteractions = new Map();

client.once("ready", () => {
    console.log(`✅ [BOT.JS] نظام التذاكر النظيف 100% - جاهز للعمل!`);
});

// أمر إنشاء لوحة التذاكر الرئيسية
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (message.content === "!setup-ticket") {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ تحتاج صلاحية أدمن لاستخدام هذا الأمر.");
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder("يرجى اختيار نوع التذكرة")
            .addOptions([
                { label: "التواصل مع الإدارة", description: "فتح تذكرة للتحدث مع الإدارة", value: "contact_admin" },
                { label: "الشكاوي", description: "تقديم شكوى رسمية", value: "complaints" },
                { label: "طلب رول", description: "طلب رتبة أو صلاحية", value: "role_request" },
                { label: "اخرى", description: "أسباب أخرى للتواصل", value: "other_reason" }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        // لوحة التذاكر الرئيسية: إمبيد نظيف يدمج الصورة بشكل عريض وبدون روابط نصية
        const mainEmbed = new EmbedBuilder()
            .setImage("https://cdn.discordapp.com/attachments/1528930680464216226/1529189507507687515/banner.jpg.jpg")
            .setColor("#2b2d31");

        await message.channel.send({
            embeds: [mainEmbed],
            components: [row]
        });
    }
});

// حدث التفاعل مع القائمة والأزرار
client.on("interactionCreate", async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
        
        // الرد الفوري السريع المخفي (لك أنت بس ما يشوفه أحد غيرك)
        await interaction.deferReply({ ephemeral: true });

        try {
            const expectedChannelName = `ticket-${interaction.user.username}`.toLowerCase();
            const hasExistingTicket = interaction.guild.channels.cache.some(ch => ch.name.toLowerCase() === expectedChannelName);

            if (hasExistingTicket) {
                return await interaction.editReply({
                    content: "❌ لا يمكنك فتح تذكرة جديدة لأن لديك تذكرة مفتوحة بالفعل!"
                });
            }

            const parentCategory = interaction.channel.parentId;
            const currentPosition = interaction.channel.position;

            // إنشاء روم التيكت
            const ticketChannel = await interaction.guild.channels.create({
                name: `ticket-${interaction.user.username}`, 
                type: ChannelType.GuildText,
                parent: parentCategory, 
                position: currentPosition + 1, 
                permissionOverwrites: [
                    {
                        id: interaction.guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: interaction.user.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    }
                ],
            });

            const closeBtn = new ButtonBuilder().setCustomId("close_ticket").setLabel("إغلاق 🔒").setStyle(ButtonStyle.Secondary);
            const claimBtn = new ButtonBuilder().setCustomId("claim_ticket").setLabel("استلام 👤").setStyle(ButtonStyle.Secondary);
            const callBtn = new ButtonBuilder().setCustomId("call_admin").setLabel("استدعاء ➡️").setStyle(ButtonStyle.Secondary);
            const otherAdminBtn = new ButtonBuilder().setCustomId("other_admin").setLabel("طلب إداري آخر 🔄").setStyle(ButtonStyle.Secondary);

            const btnRow = new ActionRowBuilder().addComponents(closeBtn, claimBtn, callBtn, otherAdminBtn);

            let typeNameArabic = "عامة";
            if (interaction.values[0] === "contact_admin") typeNameArabic = "إدارة";
            else if (interaction.values[0] === "complaints") typeNameArabic = "شكوى";
            else if (interaction.values[0] === "role_request") typeNameArabic = "رول";

            // 💎 الحل المثالي: إمبيد واحد مدمج يجمع الصورة الكبيرة فوق والكلام والأزرار تحتها مباشرة بدون أي روابط نصية!
            const finalTicketEmbed = new EmbedBuilder()
                .setDescription(`\`@Super Support\` , \`@Plus Support\` , \`@Support\` , ${interaction.user}\n\n**نوع التذكرة:** ${typeNameArabic}`)
                .setImage("https://cdn.discordapp.com/attachments/1528930680464216226/1529189507507687515/banner.jpg.jpg")
                .setColor("#2b2d31");

            await ticketChannel.send({
                embeds: [finalTicketEmbed],
                components: [btnRow]
            });

            // تعديل الرد المخفي (يظهر لك أنت فقط كرسالة نظام مؤقتة)
            await interaction.editReply({
                content: `✅ **تم فتح تذكرتك بنجاح هنا:** ${ticketChannel}`
            });

            // حفظ التفاعل لحذفه كلياً عند الإغلاق
            ticketInteractions.set(ticketChannel.id, interaction);

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `❌ حدث خطأ غير متوقع أثناء فتح التذكرة.` }).catch(() => {});
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === "close_ticket") {
            await interaction.reply({ content: "🔒 سيتم إغلاق التذكرة وحذف الروم والإشعار خلال 3 ثوانٍ..." });

            // حذف الرسالة المخفية تلقائياً عند الإغلاق
            const savedInteraction = ticketInteractions.get(interaction.channel.id);
            if (savedInteraction) {
                try {
                    await savedInteraction.deleteReply().catch(() => {});
                } catch (err) {}
                ticketInteractions.delete(interaction.channel.id);
            }

            // حذف الروم
            setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
            
        } else if (interaction.customId === "claim_ticket") {
            await interaction.reply({ content: `👤 تم استلام التذكرة من قبل: ${interaction.user}` });
        } else {
            await interaction.reply({ content: `🔄 تم إرسال طلبك بنجاح إلى فريق الدعم.`, ephemeral: true });
        }
    }
});

client.login('client.login(process.env.TOKEN););